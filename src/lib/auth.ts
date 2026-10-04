import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import env from "../config/env";
import { sendOTPEmail, sendResetPasswordEmail } from "./mailer";
import prisma from "./prisma";

const isDev = env.NODE_ENV === "development";
const isProduction = env.NODE_ENV === "production";
const clientOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,

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
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      httpOnly: true,
      path: "/",
    },
  },
  //  advanced: {
  //   useSecureCookies: true,
  //   defaultCookieAttributes: {
  //     sameSite: "none",
  //     secure: true,
  //     httpOnly: true,
  //   },
  // },

  trustedOrigins: Array.from(
    new Set([...clientOrigins, ...(isDev ? ["http://localhost:3000"] : [])]),
  ).filter(Boolean),
});

export default auth;
