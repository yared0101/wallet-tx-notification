const { baseUrl, prisma, bot, buyTokens } = require("../config");
const {
    formatSendComplete,
    formatSendPending,
    isBlackListed,
    toDecimalComplete,
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
    const alreadyTx = await prisma.pendingTransactions.findFirst({
        where: { transactionHash: { equals: txn.hash, mode: "insensitive" } },
    });
    if (alreadyTx) {
        return;
    }
    const isSwap = !(txn.input === "" || txn.input === "0x");
    if (!isSwap) {
        txn.input = "";
    }
    const isSell = !Boolean(parseInt(txn.value));
    const filter = isSwap
        ? isSell
            ? { sendSellTx: true }
            : {
                  sendBuyTx: true,
                  OR: [
                      {
                          minimumEther: {
                              lte: Number(toDecimalComplete(txn.value)),
                          },
                      },
                      {
                          minimumEther: null,
                      },
                  ],
              }
        : {};
    let toFilter = isSwap ? {} : { incomingTransfer: true };
    let fromFilter = isSwap ? {} : { outGoingTransfer: true };
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
                    where: { sendPending: true, ...filter, ...toFilter },
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
                    where: { sendPending: true, ...filter, ...fromFilter },
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
            try {
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
                const message = formatSendPending(txn, account, baseUrl);
                for (let channel of account.channel) {
                    const data = await bot.telegram.sendMessage(
                        `${channel.channelId}`,
                        message,
                        {
                            disable_web_page_preview: true,
                        }
                    );
                    console.log(data);
                }
            } catch (e) {
                console.log(e);
            }
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
    const isSwap = !(txn.input === "" || txn.input === "0x");
    if (!isSwap) {
        txn.input = "";
    }
    console.log({ input: txn.input });
    let transferFilter = {};
    if (!isSwap) {
        transferFilter =
            txn.from.toLowerCase() === wallet.account.toLowerCase()
                ? { outGoingTransfer: true }
                : { incomingTransfer: true };
    }
    const extraData =
        isSwap && (await getInternalTransaction(txn.hash, wallet.account));
    let filter = isSell ? { sendSellTx: true } : { sendBuyTx: true };
    filter = {
        ...filter,
        OR: [
            {
                minimumEther: {
                    lte: Number(
                        toDecimalComplete(extraData?.value || txn.value)
                    ),
                },
            },
            {
                minimumEther: null,
            },
        ],
    };
    const channels = await prisma.channel.findMany({
        where: {
            wallets: {
                some: {
                    account: { equals: wallet.account, mode: "insensitive" },
                },
            },
            sendComplete: true,
            ...filter,
            ...transferFilter,
        },
        include: {
            blackListedTokens: true,
            buyBlackListedTokens: true,
        },
    });
    const tokenData = isSwap
        ? await erc20TokenTransferEvents(wallet.account, txn.hash)
        : [];
    const message = formatSendComplete(
        txn,
        wallet,
        baseUrl,
        isSell && extraData?.value,
        tokenData
    );
    for (let channel of channels) {
        const tokens = tokenData.map((elem) => elem.contractAddress);
        let send = message ? true : false;
        console.log({ send });
        let realBuy = false;
        if (tokenData && tokenData.length === 2) {
            if (
                buyTokens.find((elem) => elem === tokenData[0].contractAddress)
            ) {
                realBuy = true;
            }
        }
        if (realBuy) {
            console.log({ buy: channel.buyBlackListedTokens });
            for (let token of channel.buyBlackListedTokens) {
                if (tokens.indexOf(token.contractId.toLowerCase()) !== -1) {
                    send = false;
                }
            }
        } else {
            if (isSell) {
                console.log({ sell: channel.blackListedTokens });
                for (let token of channel.blackListedTokens) {
                    if (tokens.indexOf(token.contractId.toLowerCase()) !== -1) {
                        send = false;
                    }
                }
            } else {
                console.log({ buy: channel.buyBlackListedTokens });
                for (let token of channel.buyBlackListedTokens) {
                    if (tokens.indexOf(token.contractId.toLowerCase()) !== -1) {
                        send = false;
                    }
                }
            }
        }
        console.log({ send });
        send &&
            (await bot.telegram.sendMessage(
                `${channel.channelId}`,
                // process.env.GROUP_ID,
                message,
                {
                    // reply_to_message_id: foundPending.telegramSentMessageId,
                    // allow_sending_without_reply: true,
                    disable_web_page_preview: true,
                }
            ));
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
            // console.log(wallet.pendingTransactions);
            const lastTransaction = await getLastTransaction(wallet.account);
            if (!lastTransaction) {
                continue;
            }
            // console.log({ lastTransaction });
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
                    console.log(lastTransaction.isError);
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

// const trans = {
//     blockNumber: "15521073",
//     timeStamp: "1662988845",
//     hash: "0xa7f2b8f41aba94cac1c06153e11b216d63ec0a67daeb8f8944110d2f972d3ab5",
//     nonce: "8",
//     blockHash:
//         "0x684f2a745053c938e61f78095a407a27d421a37ca55efe0a7b728d8b1c6cb154",
//     transactionIndex: "48",
//     from: "0x5fe10ffd7040e2a84d856428f2c2baec698bd559",
//     to: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
//     value: "500000000000000000",
//     gas: "242074",
//     gasPrice: "29629246108",
//     isError: "1",
//     txreceipt_status: "0",
//     input: "0x5ae401dc00000000000000000000000000000000000000000000000000000000631f390100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e4472b43f300000000000000000000000000000000000000000000000006f05b59d3b200000000000000000000000000000000000000000000000000000000072ce171f91400000000000000000000000000000000000000000000000000000000000000800000000000000000000000005fe10ffd7040e2a84d856428f2c2baec698bd5590000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000d405719fd7effba6449acbb377d1e6b542fd3b5100000000000000000000000000000000000000000000000000000000",
//     contractAddress: "",
//     cumulativeGasUsed: "4310432",
//     gasUsed: "210348",
//     confirmations: "55197",
//     methodId: "0x5ae401dc",
//     functionName: "multicall(uint256 deadline, bytes[] data)",
// };
// (async () => {
//     const walletAddress = "0x5FE10fFD7040e2a84d856428f2C2BAeC698Bd559";
//     const acc = await prisma.account.findFirst({
//         where: {
//             account: {
//                 equals: walletAddress,
//                 mode: "insensitive",
//             },
//         },
//     });
//     if (trans?.isError === "0") {
//         await processCompleted(trans, acc);
//     }
// })();
