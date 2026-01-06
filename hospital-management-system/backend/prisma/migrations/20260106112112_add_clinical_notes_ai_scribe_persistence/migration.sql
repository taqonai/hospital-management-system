-- CreateEnum
CREATE TYPE "ClinicalNoteType" AS ENUM ('SOAP', 'PROGRESS', 'PROCEDURE', 'DISCHARGE', 'ADMISSION', 'CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'TELEHEALTH');

-- CreateEnum
CREATE TYPE "ClinicalNoteStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'SIGNED', 'AMENDED', 'ADDENDUM');

-- CreateEnum
CREATE TYPE "ScribeSessionStatus" AS ENUM ('ACTIVE', 'TRANSCRIBING', 'GENERATING_NOTE', 'NOTE_GENERATED', 'COMPLETED', 'CANCELLED', 'ERROR');

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "consultationId" TEXT,
    "appointmentId" TEXT,
    "noteType" "ClinicalNoteType" NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "fullText" TEXT,
    "status" "ClinicalNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiSessionId" TEXT,
    "transcriptId" TEXT,
    "modelVersion" TEXT,
    "suggestedIcdCodes" JSONB,
    "suggestedCptCodes" JSONB,
    "keyFindings" TEXT[],
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteDiagnosis" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "icdCode" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteExtractedPrescription" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "medication" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "duration" TEXT,
    "route" TEXT,
    "instructions" TEXT,
    "warnings" TEXT[],
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteExtractedPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiScribeSession" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "sessionType" TEXT NOT NULL DEFAULT 'consultation',
    "status" "ScribeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "patientContext" JSONB,
    "transcriptText" TEXT,
    "transcriptSegments" JSONB,
    "extractedEntities" JSONB,
    "generatedNote" JSONB,
    "noteId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiScribeSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicalNote_hospitalId_patientId_idx" ON "ClinicalNote"("hospitalId", "patientId");

-- CreateIndex
CREATE INDEX "ClinicalNote_hospitalId_authorId_idx" ON "ClinicalNote"("hospitalId", "authorId");

-- CreateIndex
CREATE INDEX "ClinicalNote_hospitalId_status_idx" ON "ClinicalNote"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "ClinicalNote_aiSessionId_idx" ON "ClinicalNote"("aiSessionId");

-- CreateIndex
CREATE INDEX "NoteDiagnosis_noteId_idx" ON "NoteDiagnosis"("noteId");

-- CreateIndex
CREATE INDEX "NoteExtractedPrescription_noteId_idx" ON "NoteExtractedPrescription"("noteId");

-- CreateIndex
CREATE INDEX "AiScribeSession_hospitalId_status_idx" ON "AiScribeSession"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "AiScribeSession_hospitalId_userId_idx" ON "AiScribeSession"("hospitalId", "userId");

-- CreateIndex
CREATE INDEX "AiScribeSession_patientId_idx" ON "AiScribeSession"("patientId");

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_aiSessionId_fkey" FOREIGN KEY ("aiSessionId") REFERENCES "AiScribeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteDiagnosis" ADD CONSTRAINT "NoteDiagnosis_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteExtractedPrescription" ADD CONSTRAINT "NoteExtractedPrescription_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiScribeSession" ADD CONSTRAINT "AiScribeSession_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiScribeSession" ADD CONSTRAINT "AiScribeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiScribeSession" ADD CONSTRAINT "AiScribeSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
