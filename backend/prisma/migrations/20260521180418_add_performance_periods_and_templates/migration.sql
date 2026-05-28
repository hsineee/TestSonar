-- CreateTable
CREATE TABLE "performance_periods" (
    "id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "performance_periods_quarter_key" ON "performance_periods"("quarter");
