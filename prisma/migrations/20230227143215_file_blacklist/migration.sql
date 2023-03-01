-- CreateTable
CREATE TABLE "BlackListTokensForFiles" (
    "id" SERIAL NOT NULL,
    "contractId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "BlackListTokensForFiles_pkey" PRIMARY KEY ("id")
);
