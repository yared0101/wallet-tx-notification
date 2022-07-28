/*
  Warnings:

  - A unique constraint covering the columns `[contractId]` on the table `BlackListContracts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "BlackListContracts_contractId_key" ON "BlackListContracts"("contractId");
