import { Request, Response } from "express";
import { uploadToSupabase, uploadToCloudinary, deleteFromCloudinary } from "./upload.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";
import { validateUploadedFile } from "./upload.validation";

const uploadFile = async (file: Express.Multer.File, folder?: string, useCloudinary = false) => {
  try {
    return useCloudinary
      ? await uploadToCloudinary(file)
      : await uploadToSupabase(file, folder);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ApiError(502, `File upload failed: ${message}`);
  }
};

export const uploadSingle = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const validationError = validateUploadedFile(req.file);
  if (validationError) throw ApiError.badRequest(validationError);

  const useCloudinary = req.body.storage === "cloudinary" || req.body.folder === "chat";
  const result = await uploadFile(
    req.file,
    typeof req.body.folder === "string" ? req.body.folder : undefined,
    useCloudinary,
  );
  ApiResponse.created(res, result);
});

export const uploadMultiple = asyncHandler(async (req: Request, res: Response) => {
  const files = req.files;
  if (!Array.isArray(files) || files.length === 0) throw ApiError.badRequest("No files provided");

  for (const file of files) {
    const validationError = validateUploadedFile(file);
    if (validationError) throw ApiError.badRequest(validationError);
  }

  const results = await Promise.all(
    files.map((file) => uploadFile(
      file,
      typeof req.body.folder === "string" ? req.body.folder : undefined,
      req.body.storage === "cloudinary" || req.body.folder === "chat",
    )),
  );
  ApiResponse.created(res, results);
});

export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  await deleteFromCloudinary(req.params.publicId as string);
  ApiResponse.success(res, null, "File deleted");
});
