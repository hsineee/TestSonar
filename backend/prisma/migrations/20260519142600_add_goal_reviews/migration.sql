-- DropForeignKey
ALTER TABLE "performance_reviews" DROP CONSTRAINT "performance_reviews_templateId_fkey";

-- AlterTable
ALTER TABLE "feedback_entries" ADD COLUMN     "goalId" TEXT;

-- AlterTable
ALTER TABLE "performance_reviews" ADD COLUMN     "finalGrade" TEXT,
ADD COLUMN     "overallComment" TEXT,
ALTER COLUMN "templateId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "review_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_entries" ADD CONSTRAINT "feedback_entries_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
