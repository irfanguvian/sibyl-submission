-- AlterTable
ALTER TABLE "case" ADD COLUMN     "description" TEXT,
ADD COLUMN     "matchedTutorId" TEXT;

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "case_matchedTutorId_idx" ON "case"("matchedTutorId");

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_matchedTutorId_fkey" FOREIGN KEY ("matchedTutorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
