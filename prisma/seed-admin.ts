import { hashPassword } from "better-auth/crypto";
import prisma from "../src/lib/prisma";
import env from "../src/config/env";

async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL.toLowerCase().trim();
  const password = await hashPassword(env.ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: env.ADMIN_NAME,
      role: "admin",
      status: "accepted",
      emailVerified: true,
    },
    create: {
      name: env.ADMIN_NAME,
      email,
      emailVerified: true,
      role: "admin",
      status: "accepted",
      category: [],
    },
  });

  const credential = await prisma.account.findFirst({
    where: { userId: admin.id, providerId: "credential" },
  });

  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: { accountId: admin.id, password },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: admin.id,
        providerId: "credential",
        accountId: admin.id,
        password,
      },
    });
  }

}

seedAdmin()
  .catch((error) => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
