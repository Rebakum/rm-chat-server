import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import * as ctrl from "./recording.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { uploadRecordingSchema } from "./recording.validation";

// diskStorage, not memoryStorage: a 40-minute class is ~750MB, and buffering
// several of those in RAM at once would take the API down. Files land in the
// OS temp dir and the service unlinks them once Cloudinary has them.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) =>
      cb(null, `rec-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || ".webm"}`),
  }),
  limits: { fileSize: 800 * 1024 * 1024 }, // ~৪০ মিনিট @2.5Mbps পর্যন্ত
});

const router = Router();

router.post("/recordings", requireAuth, upload.single("video"), validateRequest(uploadRecordingSchema), ctrl.uploadRecording);
router.get("/recordings/mine", requireAuth, ctrl.getMyRecordings);
router.get("/recordings/booking/:bookingId", requireAuth, ctrl.getRecordingsByBooking);
router.get("/recordings", requireAdmin, ctrl.getAllRecordings);
router.delete("/recordings/:id", requireAdmin, ctrl.deleteRecording);

export default router;
