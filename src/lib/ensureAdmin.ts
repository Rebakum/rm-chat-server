import auth from "./auth";
import prisma from "./prisma";
import logger from "./logger";
import env from "../config/env";
import { hashPassword } from "better-auth/crypto";

export default async function ensureAdmin(): Promise<void> {
  logger.info("Checking admin account...");

  const email = env.ADMIN_EMAIL.toLowerCase().trim();

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (existing) {
      if (existing.role !== "admin") {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: "admin", status: "accepted", emailVerified: true },
        });
        logger.info("Admin already exists — role upgraded to admin.");
      } else {
        logger.info("Admin already exists.");
      }
      return;
    }

    try {
      await auth.api.signUpEmail({
        body: {
          name: env.ADMIN_NAME,
          email,
          password: env.ADMIN_PASSWORD,
        },
      });

      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true, role: "admin", status: "accepted" },
        });

        const credential = await prisma.account.findFirst({
          where: { userId: user.id, providerId: "credential" },
        });

        const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
        if (credential) {
          await prisma.account.update({
            where: { id: credential.id },
            data: { password: passwordHash, accountId: user.id },
          });
        } else {
          await prisma.account.create({
            data: {
              userId: user.id,
              providerId: "credential",
              accountId: user.id,
              password: passwordHash,
            },
          });
        }
      }

      logger.info("Admin account created successfully.");
    } catch (err: any) {
      const msg = String(err?.body?.message ?? err?.message ?? err ?? "");
      const isDuplicate =
        err?.body?.code === "USER_ALREADY_EXISTS" ||
        /already exists|already.*user|unique constraint|duplicate/i.test(msg);

      if (isDuplicate) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser && existingUser.role !== "admin") {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: "admin", status: "accepted", emailVerified: true },
          });
        }

        if (existingUser) {
          const existingCredential = await prisma.account.findFirst({
            where: { userId: existingUser.id, providerId: "credential" },
          });

          const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
          if (existingCredential) {
            await prisma.account.update({
              where: { id: existingCredential.id },
              data: { password: passwordHash, accountId: existingUser.id },
            });
          } else {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                providerId: "credential",
                accountId: existingUser.id,
                password: passwordHash,
              },
            });
          }
        }
        logger.info("Admin already exists.");
        return;
      }

      logger.error("Admin initialization failed:", msg || err);
      throw err;
    }
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "");
    logger.error("Admin bootstrap could not query the database:", msg);
    throw err;
  }
}
