/*
  Warnings:

  - You are about to drop the column `feedbacks` on the `performance_reviews` table. All the data in the column will be lost.
  - You are about to drop the `calibrations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `reviewerId` to the `performance_reviews` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "calibrations" DROP CONSTRAINT "calibrations_setById_fkey";

-- AlterTable
ALTER TABLE "performance_reviews" DROP COLUMN "feedbacks",
ADD COLUMN     "reviewerId" TEXT NOT NULL;

-- DropTable
DROP TABLE "calibrations";

-- CreateTable
CREATE TABLE "feedback_entries" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "dimensionName" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "quantScore" DOUBLE PRECISION,
    "impression" INTEGER,
    "comment" TEXT,
    "gapAnalysis" TEXT,

    CONSTRAINT "feedback_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_standards" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "dimensionName" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "level_standards_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_standards" ADD CONSTRAINT "level_standards_setById_fkey" FOREIGN KEY ("setById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
