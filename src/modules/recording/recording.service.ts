import prisma from "../../lib/prisma";
import { paginate } from "../../utils/pagination";
import { UploadRecordingDTO } from "./recording.interface";
import ApiError from "../../utils/ApiError";
import { cloudinary } from "../../config/cloudinary";
import { deleteFromCloudinary } from "../../config/cloudinary";
import fs from "fs";

interface MulterFile {
  originalname: string;
  path: string; // diskStorage: stream from the temp file, never buffer it in RAM
  mimetype: string;
  size: number;
}

const uploadToCloudinaryStream = (file: MulterFile): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "rahmah-recordings", resource_type: "video" },
      (error: any, result: any) => {
        if (error) reject(error);
        else resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    fs.createReadStream(file.path).pipe(stream);
  });
};

const upload = async (data: UploadRecordingDTO, userId: string, file?: MulterFile) => {
  let videoUrl = data.videoUrl;
  let publicId: string | undefined;

  if (file) {
    try {
      const result = await uploadToCloudinaryStream(file);
      videoUrl = result.url;
      publicId = result.publicId;
    } finally {
      fs.unlink(file.path, () => {}); // temp file always goes away
    }
  }
  if (!videoUrl) throw ApiError.badRequest("Video file or URL is required");

  return prisma.recording.create({
    data: {
      ...(data.bookingId ? { bookingId: data.bookingId } : {}),
      ...(data.callId ? { callId: data.callId } : {}),
      ...(data.appointmentId ? { appointmentId: data.appointmentId } : {}),
      teacherId: data.teacherId,
      studentId: data.studentId,
      videoUrl,
      publicId,
      roomName: data.roomName,
      teacherName: data.teacherName,
      studentName: data.studentName,
    },
  });
};

const getMine = async (userId: string, page: number = 1, limit: number = 20) => {
  const { skip, take } = paginate({}, page, limit);
  const where = { OR: [{ teacherId: userId }, { studentId: userId }] };
  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, displayName: true } },
        student: { select: { id: true, name: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.recording.count({ where }),
  ]);
  return { recordings, total };
};

const getByBooking = async (bookingId: string) => {
  return prisma.recording.findUnique({ where: { bookingId } });
};

const getAll = async (page: number = 1, limit: number = 20, search?: string) => {
  const { skip, take } = paginate({}, page, limit);
  const where = search
    ? {
        OR: [
          { teacherName: { contains: search, mode: "insensitive" as const } },
          { studentName: { contains: search, mode: "insensitive" as const } },
          { teacher: { is: { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } } },
          { student: { is: { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } } },
        ],
      }
    : {};
  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } },
        student: { select: { id: true, name: true, displayName: true, email: true, photoURL: true } },
        booking: true,
      },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.recording.count({ where }),
  ]);
  return { recordings, total };
};

const remove = async (id: string) => {
  const recording = await prisma.recording.findUnique({ where: { id } });
  if (recording?.publicId) {
    await deleteFromCloudinary(recording.publicId, "video");
  }
  return prisma.recording.delete({ where: { id } });
};

export { upload, getByBooking, getAll, getMine, remove };
