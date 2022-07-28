/*
  Warnings:

  - Added the required column `nameTag` to the `Account` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "nameTag" TEXT NOT NULL;
