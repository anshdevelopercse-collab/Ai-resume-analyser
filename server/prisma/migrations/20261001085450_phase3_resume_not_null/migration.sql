/*
  Warnings:

  - Made the column `filename` on table `resumes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `original_name` on table `resumes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mime_type` on table `resumes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `size_bytes` on table `resumes` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "resumes" ALTER COLUMN "filename" SET NOT NULL,
ALTER COLUMN "original_name" SET NOT NULL,
ALTER COLUMN "mime_type" SET NOT NULL,
ALTER COLUMN "size_bytes" SET NOT NULL;
