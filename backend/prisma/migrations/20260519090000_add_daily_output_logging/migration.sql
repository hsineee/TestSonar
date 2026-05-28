-- CreateTable
CREATE TABLE "daily_output_tags" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_output_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_output_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_output_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_output_tags_code_key" ON "daily_output_tags"("code");

-- CreateIndex
CREATE INDEX "daily_output_logs_userId_logDate_idx" ON "daily_output_logs"("userId", "logDate");

-- CreateIndex
CREATE INDEX "daily_output_logs_tagId_idx" ON "daily_output_logs"("tagId");

-- AddForeignKey
ALTER TABLE "daily_output_logs" ADD CONSTRAINT "daily_output_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_output_logs" ADD CONSTRAINT "daily_output_logs_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "daily_output_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
