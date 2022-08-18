-- CreateTable
CREATE TABLE "Channel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT NOT NULL,
    "sendPending" BOOLEAN NOT NULL DEFAULT true,
    "sendComplete" BOOLEAN NOT NULL DEFAULT true,
    "sendBuyTx" BOOLEAN NOT NULL DEFAULT true,
    "sendSellTx" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AccountToChannel" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AccountToChannel_AB_unique" ON "_AccountToChannel"("A", "B");

-- CreateIndex
CREATE INDEX "_AccountToChannel_B_index" ON "_AccountToChannel"("B");

-- AddForeignKey
ALTER TABLE "_AccountToChannel" ADD CONSTRAINT "_AccountToChannel_A_fkey" FOREIGN KEY ("A") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AccountToChannel" ADD CONSTRAINT "_AccountToChannel_B_fkey" FOREIGN KEY ("B") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
