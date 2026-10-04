-- AlterTable
ALTER TABLE "CallSession" ADD COLUMN     "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'accepted';

-- AlterTable
ALTER TABLE "UserSkill" ADD COLUMN     "level" TEXT NOT NULL DEFAULT '';
