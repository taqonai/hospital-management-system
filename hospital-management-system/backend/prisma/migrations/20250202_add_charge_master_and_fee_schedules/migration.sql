-- CreateTable
CREATE TABLE "charge_master" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultPrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "unit" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "charge_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "payerId" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charge_master_hospitalId_category_isActive_idx" ON "charge_master"("hospitalId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "charge_master_hospitalId_code_key" ON "charge_master"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "fee_schedules_hospitalId_chargeId_effectiveFrom_effectiveTo_idx" ON "fee_schedules"("hospitalId", "chargeId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedules_hospitalId_chargeId_payerId_key" ON "fee_schedules"("hospitalId", "chargeId", "payerId");

-- AddForeignKey
ALTER TABLE "charge_master" ADD CONSTRAINT "charge_master_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charge_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "insurance_payers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
