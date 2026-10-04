import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import authService from "./auth.service";
import env from "../../config/env";
import ApiError from "../../utils/ApiError";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, termsAccepted } = req.body;
  if (termsAccepted !== true) {
    throw ApiError.badRequest("You must accept the Terms and Conditions");
  }
  const result = await authService.signup(name, email, password);
  const message = result.requiresVerification
    ? "Verification code sent to your email. Your account will be created once the code is verified."
    : "Signup successful";
  ApiResponse.created(res, result, message);
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await authService.verifyOtp(email, otp);
  ApiResponse.success(res, result, "Email verified. Your account has been created — you can now sign in.");
});

export const resendOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  await authService.resendOtp(email);
  ApiResponse.success(res, null, "A new verification code has been sent");
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestPasswordReset(req.body.email);
  ApiResponse.success(res, null, "If an account exists, a password reset link has been sent");
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  ApiResponse.success(res, null, "Password reset successfully");
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  // Forward each Set-Cookie header individually. Express supports setting
  // multiple Set-Cookie headers via an array — this preserves the original
  // cookie attributes (httpOnly, secure, sameSite, path, expires) that
  // Better Auth computed, and avoids the broken comma-join that
  // `Headers.get("set-cookie")` produces.
  if (result.setCookieHeaders.length > 0) {
    res.setHeader("Set-Cookie", result.setCookieHeaders);
  }

  ApiResponse.success(res, result.user, "Login successful");
});

export const refreshTokenController = asyncHandler(async (req: Request, res: Response) => {
  const session = await authService.refreshToken(req.headers);
  ApiResponse.success(res, session, "Session refreshed");
});

export const getMySessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await authService.listSessions(req.user!.id, req.session!.token);
  ApiResponse.success(res, sessions);
});

export const revokeOneSession = asyncHandler(async (req: Request, res: Response) => {
  await authService.revokeSession(req.user!.id, req.params.sessionId as string);
  ApiResponse.success(res, null, "Session revoked");
});

export const revokeOtherSessions = asyncHandler(async (req: Request, res: Response) => {
  const count = await authService.revokeAllOtherSessions(req.user!.id, req.session!.token);
  ApiResponse.success(res, { revoked: count }, "Other sessions revoked");
});

// Ends every session for this user (including the current one).
export const logoutAllDevices = asyncHandler(async (req: Request, res: Response) => {
  const count = await authService.logoutAllDevices(req.user!.id);
  const cookieOptions = {
    path: "/",
    sameSite: env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    secure: env.NODE_ENV === "production",
    httpOnly: true,
  };
  res.clearCookie("better-auth.session_token", cookieOptions);
  res.clearCookie("__Secure-better-auth.session_token", cookieOptions);
  ApiResponse.success(res, { revoked: count }, "Logged out on all devices");
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const profile = await authService.getFullProfile(req.user!.id);
  ApiResponse.success(res, profile);
});

/**
 * Returns the list of configured social providers and the base URL the client
 * should redirect to. The actual OAuth dance is handled by Better Auth's

 *
 * Client usage: `window.location.href = `${socialProviders.baseUrl}/google?callbackURL=${redirectUrl}``
 */
export const getSocialProviders = asyncHandler(async (_req: Request, res: Response) => {
  const providers: { id: string; name: string; enabled: boolean }[] = [
    {
      id: "google",
      name: "Google",
      enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
  ];

  ApiResponse.success(res, {
    providers,
    baseUrl: `${env.BETTER_AUTH_URL}/api/auth/sign-in/social`,
  });
});
