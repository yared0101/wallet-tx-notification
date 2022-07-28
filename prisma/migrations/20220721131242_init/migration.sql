-- CreateEnum
CREATE TYPE "completeness" AS ENUM ('PENDING', 'HALF', 'COMPLETE');

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "account" TEXT NOT NULL,
    "lastTransactionTimeStamp" TEXT NOT NULL,
    "dataComplete" "completeness" NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackListContracts" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,

    CONSTRAINT "BlackListContracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time" (
    "id" SERIAL NOT NULL,
    "totalTime" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_account_key" ON "Account"("account");
