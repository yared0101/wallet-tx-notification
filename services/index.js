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

const trans = {
    blockNumber: "15559943",
    timeStamp: "1663498151",
    hash: "0xcfa755a93e4eb10d49ecf5eaec064486b2300e7286467db0e72681947d10f604",
    nonce: "36",
    blockHash:
        "0x4764285142f3ca87f1b1bdf23949c52691384de2e26f7498f08c93c5c32ae0b1",
    transactionIndex: "49",
    from: "0x12b813b343d85476b0db88483538219e913af7cd",
    to: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    value: "0",
    gas: "263520",
    gasPrice: "4170261286",
    isError: "0",
    txreceipt_status: "1",
    input: "0x5ae401dc000000000000000000000000000000000000000000000000000000006326fe7f0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000104472b43f300000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000cdef3ef5d32000000000000000000000000000000000000000000000000000000000000008000000000000000000000000012b813b343d85476b0db88483538219e913af7cd0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000083249c6794bca5a77eb8c0af9f1a86e055459cea00000000000000000000000000000000000000000000000000000000",
    contractAddress: "",
    cumulativeGasUsed: "6435745",
    gasUsed: "210023",
    confirmations: "121",
    methodId: "0x5ae401dc",
    functionName: "multicall(uint256 deadline, bytes[] data)",
};
// (async () => {
//     const walletAddress = "0x12b813B343d85476B0DB88483538219E913aF7Cd";
//     const acc = await prisma.account.findFirst({
//         where: {
//             account: {
//                 equals: walletAddress,
//                 mode: "insensitive",
//             },
//         },
//     });

//     await processCompleted(trans, acc);
// })();
