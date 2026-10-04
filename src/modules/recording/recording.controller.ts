import { Request, Response } from "express";
import * as recordingService from "./recording.service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";

const uploadRecording = asyncHandler(async (req: Request, res: Response) => {
  const recording = await recordingService.upload(req.body, req.user!.id, req.file as any);
  ApiResponse.created(res, recording);
});

const getRecordingsByBooking = asyncHandler(async (req: Request, res: Response) => {
  const recordings = await recordingService.getByBooking(req.params.bookingId as string);
  if (recordings) {
    const userId = req.user!.id;
    const userRole = (req.user as any).role;
    if (userRole !== "admin" && recordings.teacherId !== userId && recordings.studentId !== userId) {
      throw ApiError.forbidden("Not authorized to view this recording");
    }
  }
  ApiResponse.success(res, recordings);
});

const getMyRecordings = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const { recordings, total } = await recordingService.getMine(req.user!.id, page, limit);
  ApiResponse.paginated(res, recordings, total, page, limit);
});

const getAllRecordings = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(String(req.query.page ?? 1));
  const limit = Math.min(Number(String(req.query.limit ?? 20)), 100);
  const search = req.query.search ? String(req.query.search).trim() : undefined;
  const { recordings, total } = await recordingService.getAll(page, limit, search);
  ApiResponse.paginated(res, recordings, total, page, limit);
});

const deleteRecording = asyncHandler(async (req: Request, res: Response) => {
  await recordingService.remove(req.params.id as string);
  ApiResponse.success(res, null, "Recording deleted");
});

export { uploadRecording, getRecordingsByBooking, getMyRecordings, getAllRecordings, deleteRecording };
