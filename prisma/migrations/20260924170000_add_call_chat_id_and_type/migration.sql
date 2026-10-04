-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('video', 'audio');

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "chatId" TEXT NOT NULL,
ADD COLUMN     "type" "CallType" NOT NULL;
