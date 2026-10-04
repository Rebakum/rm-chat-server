import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { authValidation } from "./auth.validation";
import { authenticate } from "../../middlewares/auth";
import {
  signup,
  verifyOTP,
  resendOTP,
  loginController,
  refreshTokenController,
  getMySessions,
  revokeOneSession,
  revokeOtherSessions,
  logoutAllDevices,
  getMe,
  forgotPassword,
  resetPassword,
  getSocialProviders,
} from "./auth.controller";

const router = express.Router();

// ---- Public routes (no session required) ---------------------------------
router.post("/signup", validateRequest(authValidation.signupSchema), signup);
router.post("/verify-otp", validateRequest(authValidation.otpSchema), verifyOTP);
router.post("/resend-otp", validateRequest(authValidation.resendOtpSchema), resendOTP);
router.post("/forgot-password", validateRequest(authValidation.forgotPasswordSchema), forgotPassword);
router.post("/reset-password", validateRequest(authValidation.resetPasswordSchema), resetPassword);
router.post("/login", validateRequest(authValidation.loginSchema), loginController);
router.post("/refresh-token", refreshTokenController);
router.get("/social-providers", getSocialProviders);



// ---- Protected routes (session required) ---------------------------------
router.get("/sessions", authenticate, getMySessions);
router.delete("/sessions/:sessionId", authenticate, revokeOneSession);
router.post("/sessions/revoke-others", authenticate, revokeOtherSessions);
router.post("/logout", authenticate, logoutAllDevices);
router.get("/me", authenticate, getMe);

export const authRouter = router;
export default router;
