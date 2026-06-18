-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "qualifications" TEXT[],
    "experiences" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutor_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "budgetPerHour" INTEGER NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "caseId" TEXT,
    "tutorProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_invite" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_access_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_refresh_token" (
    "id" TEXT NOT NULL,
    "accessTokenId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_profile_userId_key" ON "tutor_profile"("userId");

-- CreateIndex
CREATE INDEX "tutor_profile_displayName_idx" ON "tutor_profile"("displayName");

-- CreateIndex
CREATE INDEX "case_ownerId_idx" ON "case"("ownerId");

-- CreateIndex
CREATE INDEX "case_status_idx" ON "case"("status");

-- CreateIndex
CREATE UNIQUE INDEX "document_storedKey_key" ON "document"("storedKey");

-- CreateIndex
CREATE INDEX "document_caseId_idx" ON "document"("caseId");

-- CreateIndex
CREATE INDEX "document_tutorProfileId_idx" ON "document"("tutorProfileId");

-- CreateIndex
CREATE INDEX "case_invite_tutorId_idx" ON "case_invite"("tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "case_invite_caseId_tutorId_key" ON "case_invite"("caseId", "tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_token_tokenHash_key" ON "oauth_access_token"("tokenHash");

-- CreateIndex
CREATE INDEX "oauth_access_token_userId_idx" ON "oauth_access_token"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_token_accessTokenId_key" ON "oauth_refresh_token"("accessTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_token_tokenHash_key" ON "oauth_refresh_token"("tokenHash");

-- AddForeignKey
ALTER TABLE "tutor_profile" ADD CONSTRAINT "tutor_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_tutorProfileId_fkey" FOREIGN KEY ("tutorProfileId") REFERENCES "tutor_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_invite" ADD CONSTRAINT "case_invite_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_invite" ADD CONSTRAINT "case_invite_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "oauth_access_token"("id") ON DELETE CASCADE ON UPDATE CASCADE;
