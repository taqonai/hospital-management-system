-- CreateEnum
CREATE TYPE "NoShowReason" AS ENUM ('AUTO_TIMEOUT', 'MANUAL_STAFF', 'MANUAL_DOCTOR', 'PATIENT_CALLED');

-- CreateEnum
CREATE TYPE "StageAlertType" AS ENUM ('NO_VITALS', 'NO_DOCTOR', 'WAITING_TOO_LONG');

-- CreateEnum
CREATE TYPE "StageAlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "no_show_logs" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "reason" "NoShowReason" NOT NULL,
    "slotTime" TEXT NOT NULL,
    "timeoutMinutes" INTEGER NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slotReleased" BOOLEAN NOT NULL DEFAULT false,
    "slotReleasedAt" TIMESTAMP(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "no_show_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_alerts" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "alertType" "StageAlertType" NOT NULL,
    "status" "StageAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "stage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "no_show_logs_hospitalId_triggeredAt_idx" ON "no_show_logs"("hospitalId", "triggeredAt");

-- CreateIndex
CREATE INDEX "no_show_logs_appointmentId_idx" ON "no_show_logs"("appointmentId");

-- CreateIndex
CREATE INDEX "no_show_logs_patientId_idx" ON "no_show_logs"("patientId");

-- CreateIndex
CREATE INDEX "stage_alerts_hospitalId_status_idx" ON "stage_alerts"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "stage_alerts_appointmentId_idx" ON "stage_alerts"("appointmentId");

-- CreateIndex
CREATE INDEX "stage_alerts_doctorId_status_idx" ON "stage_alerts"("doctorId", "status");

-- AddForeignKey
ALTER TABLE "no_show_logs" ADD CONSTRAINT "no_show_logs_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_logs" ADD CONSTRAINT "no_show_logs_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_logs" ADD CONSTRAINT "no_show_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_logs" ADD CONSTRAINT "no_show_logs_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_alerts" ADD CONSTRAINT "stage_alerts_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_alerts" ADD CONSTRAINT "stage_alerts_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_alerts" ADD CONSTRAINT "stage_alerts_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_alerts" ADD CONSTRAINT "stage_alerts_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
