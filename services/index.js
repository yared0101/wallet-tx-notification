const { baseUrl, prisma, bot } = require("../config");
const {
    formatSendComplete,
    formatSendPending,
    isBlackListed,
} = require("../utils");
const {
    getInternalTransaction,
    erc20TokenTransferEvents,
    getLastTransaction,
} = require("../utils/cryptoFunctions");
/**
 * @param {{
 *  blockHash: string,
 *  blockNumber: string,
 *  from: string,
 *  gasPrice: string,
 *  maxFeePerGas: string,
 *  maxPriorityFeePerGas: string,
 *  hash: string,
 *  input: string,
 *  nonce: string,
 *  to: string,
 *  transactionIndex: string,
 *  value: string,
 *  type: string,
 *  accessList: Array<string>,
 *  v: string,
 *  r: string,
 *  s: string
 * }} txn
 * @param {Array<string>} tokens
 */
const processPending = async (txn) => {
    const isSell = !Boolean(parseInt(txn.value));
    const filter = isSell ? { sendSellTx: true } : { sendBuyTx: true };

    try {
        const account1 = prisma.account.findFirst({
            where: {
                account: {
                    equals: txn.to,
                    mode: "insensitive",
                },
            },
            include: {
                pendingTransactions: true,
                channel: {
                    where: { sendPending: true, ...filter },
                },
            },
        });
        const account2 = prisma.account.findFirst({
            where: {
                account: {
                    equals: txn.from,
                    mode: "insensitive",
                },
            },
            include: {
                pendingTransactions: true,
                channel: {
                    where: { sendPending: true, ...filter },
                },
            },
        });
        // console.log({ account1, account2 });
        const accounts = await Promise.all([account1, account2]);
        // console.log({ accounts });
        for (let account of accounts) {
            if (!account) {
                continue;
            }
            const message = formatSendPending(txn, account, baseUrl);
            for (let channel of account.channel) {
                const data = await bot.telegram.sendMessage(
                    `@${channel.channelId}`,
                    message,
                    {
                        disable_web_page_preview: true,
                    }
                );
                console.log(data);
            }
            await prisma.account.update({
                where: { id: account.id },
                data: {
                    pendingTransactions: {
                        create: {
                            transactionHash: txn.hash,
                            telegramSentMessageId: 1,
                        },
                    },
                },
            });
        }
    } catch (e) {
        console.log("process pending", e);
    }
};
/**
 *
 * @param {{
 *  blockNumber: string,
 *  timeStamp: string,
 *  hash: string,
 *  blockHash: string,
 *  transactionIndex: string,
 *  from: string,
 *  to: string,
 *  value: string,
 *  gas: string,
 *  gasPrice: string,
 *  isError: string,
 *  txreceipt_status: string,
 *  input: string,
 *  contractAddress: string,
 *  cumulativeGasUsed: string,
 *  gasUsed: string,
 *  confirmations: string,
 * }} txn
 * @param {import('@prisma/client').Account} wallet
 * @returns
 */
const processCompleted = async (txn, wallet) => {
    const isSell = !Boolean(parseInt(txn.value));
    const filter = isSell ? { sendSellTx: true } : { sendBuyTx: true };
    const channels = await prisma.channel.findMany({
        where: {
            wallets: {
                some: {
                    account: { equals: wallet.account, mode: "insensitive" },
                },
            },
            sendComplete: true,
            ...filter,
        },
    });
    const extraData =
        isSell && (await getInternalTransaction(txn.hash, wallet.account));
    const tokenData = await erc20TokenTransferEvents(wallet.account, txn.hash);
    const message = formatSendComplete(
        txn,
        wallet,
        baseUrl,
        isSell && extraData?.value,
        tokenData
    );
    for (let channel of channels) {
        await bot.telegram.sendMessage(
            `@${channel.channelId}`,
            // process.env.GROUP_ID,
            message,
            {
                // reply_to_message_id: foundPending.telegramSentMessageId,
                // allow_sending_without_reply: true,
                disable_web_page_preview: true,
            }
        );
    }
};
const intervalFunction = async () => {
    try {
        const wallets = await prisma.account.findMany({
            include: { pendingTransactions: true },
        });
        const tokens = await prisma.blackListContracts.findMany();
        for (let wallet of wallets) {
            if (!wallet.pendingTransactions.length) {
                continue;
            }
            const lastTransaction = await getLastTransaction(wallet.account);
            if (!lastTransaction) {
                continue;
            }
            const pendings = wallet.pendingTransactions.map((elem) =>
                elem.transactionHash.toLowerCase()
            );
            const foundIndex = pendings.indexOf(
                lastTransaction.hash.toLowerCase()
            );
            if (foundIndex === -1) {
                //means no pending
            } else {
                // if not in blacklist send completed tx, if it is then edit the text as blacklisted token

                //remove it from pending
                const foundPending = wallet.pendingTransactions[foundIndex];

                const data = isBlackListed(
                    lastTransaction.contractAddress?.toLowerCase(),
                    tokens,
                    foundPending
                );
                await prisma.account.update({
                    where: { id: wallet.id },
                    data: {
                        lastTransactionTimeStamp: lastTransaction.hash,
                        pendingTransactions: {
                            delete: {
                                id: foundPending.id,
                            },
                        },
                    },
                });
                if (data) {
                    continue;
                } else {
                    if (lastTransaction?.isError === "0") {
                        await processCompleted(lastTransaction, wallet);
                    }
                }
            }
        }
    } catch (e) {
        console.log("set - interval", e);
    }
};
module.exports = {
    processCompleted,
    processPending,
    intervalFunction,
};
