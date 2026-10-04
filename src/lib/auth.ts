import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import prisma from "./prisma";
import { sendOTPEmail, sendResetPasswordEmail } from "./mailer";
import env from "../config/env";

const isDev = env.NODE_ENV === "development";

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, user.name || user.email, url);
    },
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 5 * 60,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const purpose = type === "change-email" ? "email-verification" : type;
        await sendOTPEmail(email, email, otp, purpose);
      },
    }),
  ],

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "student" },
      status: { type: "string", defaultValue: "accepted" },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
    disableSessionRefresh: false,
    cookieCache: {
      enabled: false,
    },
  },

  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: !isDev,
      httpOnly: true,
      path: "/",
    },
  },

  trustedOrigins: Array.from(
    new Set([
      ...env.CLIENT_URL.split(",").map((u) => u.trim()),
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ])
  ).filter(Boolean),
});

export default auth;
