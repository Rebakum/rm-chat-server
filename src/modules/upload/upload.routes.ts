import { Router } from "express";
import multer from "multer";
import { uploadSingle, uploadMultiple, deleteFile } from "./upload.controller";
import { requireAuth } from "../../middlewares/auth";
import { MAX_FILE_SIZE_BYTES } from "./upload.validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10 },
});

const router = Router();

router.post("/upload", requireAuth, upload.single("file"), uploadSingle);
router.post("/upload/multiple", requireAuth, upload.array("files", 10), uploadMultiple);
router.delete("/upload/:publicId", requireAuth, deleteFile);

export default router;
