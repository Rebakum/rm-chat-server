import { z } from "zod";

const passwordRule = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .regex(/[A-Z]/, "At least one uppercase letter")
  .regex(/[a-z]/, "At least one lowercase letter")
  .regex(/[0-9]/, "At least one number")
  .regex(/[^A-Za-z0-9]/, "At least one special character");

export const signupSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    email: z.email(),
    password: passwordRule,
    termsAccepted: z.literal(true, "You must accept the Terms and Conditions"),
  }),
});

export const otpSchema = z.object({
  body: z.object({
    email: z.email(),
    otp: z.string().length(6, "OTP must be 6 digits"),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.email() }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: passwordRule,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(1, "Password is required"),
  }),
});

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, "sessionId is required"),
  }),
});

export const authValidation = {
  signupSchema,
  otpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
  revokeSessionSchema,
};
