CREATE TABLE "MessageEditHistory" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "previousText" TEXT NOT NULL,
    "editedById" TEXT,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEditHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageEditHistory_messageId_editedAt_idx"
ON "MessageEditHistory"("messageId", "editedAt");

ALTER TABLE "MessageEditHistory"
ADD CONSTRAINT "MessageEditHistory_editedById_fkey"
FOREIGN KEY ("editedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
