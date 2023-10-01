-- CreateTable
CREATE TABLE "ContractAddressSettings" (
    "id" SERIAL NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractAddress" TEXT NOT NULL,
    "minPriorityFee" DOUBLE PRECISION NOT NULL,
    "maxPriorityFee" DOUBLE PRECISION NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "ContractAddressSettings_pkey" PRIMARY KEY ("id")
);
