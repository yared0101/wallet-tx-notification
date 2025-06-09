const { CHANNEL_BLACK_LIST_TYPE } = require("@prisma/client");
const { baseUrl, prisma, bot, buyTokens, logger } = require("../config");
const {
    formatSendComplete,
    formatSendPending,
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
    logger.info({
        type: "PENDING",
        trace: "/services/index.js - line number 39",
        found: txn.hash,
        alreadyTx,
    });
    if (alreadyTx) {
        return;
    }
    logger.info({
        pendingTxn: txn,
        trace: "/services/index.js - line number 39",
    });
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
 *  functionName: string | null,
 * }} txn
 * @param {import('@prisma/client').Account} wallet
 * @returns
 */
const processCompleted = async (txn, wallet, mev_protected = false) => {
    logger.info({
        type: "COMPLETE",
        trace: "/services/index.js - line number 171",
        txn,
    });
    let isSwap = !(txn.input === "" || txn.input === "0x");
    const isApprove = txn.functionName?.startsWith("approve") ?? false;
    if (!isSwap) {
        txn.input = "";
    }
    console.log({
        input10: txn.input?.substring(0, 10),
        isSwap,
        txn10: txn.hash?.substring(0, 10),
    });
    let transferFilter = {};
    if (!isSwap) {
        transferFilter =
            txn.from.toLowerCase() === wallet.account.toLowerCase()
                ? { outGoingTransfer: true }
                : { incomingTransfer: true };
    }
    // keep the previous 0/non 0
    let isSell = !Boolean(parseInt(txn.value));
    const extraData = await getInternalTransaction(txn.hash, wallet.account);
    if (!extraData) {
        // if there is no extra data then it must mean it's a buy tx
        isSell = false;
    }
    console.log({
        txn10: txn.input?.substring(0, 10),
        extraData: extraData,
        isSell: isSell,
    });

    let filter = isSell ? { sendSellTx: true } : { sendBuyTx: true };
    if (isApprove) {
        filter = { sendApprove: true };
    }
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
    if (!tokenData) {
        logger.info({
            errorMessage:
                "error while getting token data(should return empty array atleast)",
            txn,
            tokenData,
        });
        return false;
    }
    if (!tokenData.length) {
        isSwap = false;
    }
    console.log(tokenData, txn.hash, wallet.account);
    // const hasTokenData = tokenData ? (tokenData.length ? true : false) : false;
    // if (isSwap && !isSell && !hasTokenData) {
    //     logger.info({
    //         errorMessage: "swap buy tx not getting token data",
    //         txn,
    //         tokenData,
    //     });
    //     return false;
    // }
    // if (isSwap && !tokenData) {
    // }
    // if (isSell && !isApprove && !extraData) {
    //     logger.info({
    //         errorMessage: "sell tx not getting internal tx",
    //         txn,
    //         extraData,
    //     });
    //     return false;
    // }
    const message = formatSendComplete(
        txn,
        wallet,
        baseUrl,
        isSell && extraData?.value,
        tokenData,
        isApprove,
        isSwap,
        isSell,
        mev_protected
    );
    if (!message) {
        console.log({
            errorMessage: "no message constructed",
            message,
            txn,
            wallet,
            baseUrl,
            isSell,
            extradataVaL: extraData?.value,
            tokenData,
            isApprove,
        });
        return false;
    }
    for (let channel of channels) {
        const tokens = tokenData?.map((elem) => elem.contractAddress) || [];
        let send = message ? true : false;
        console.log({ send1: send });
        if (!send) {
            console.log({ message });
        }
        let realBuy = false;
        if (tokenData && tokenData.length === 2) {
            if (
                buyTokens.find((elem) => elem === tokenData[0].contractAddress)
            ) {
                realBuy = true;
            }
        }
        if (realBuy) {
            // console.log({ buy: channel.buyBlackListedTokens });
            for (let token of channel.buyBlackListedTokens) {
                if (tokens.indexOf(token.contractId.toLowerCase()) !== -1) {
                    //if black/white listed in the buy list make it false
                    send = false;
                }
            }
        } else {
            if (isSell) {
                // console.log({ sell: channel.blackListedTokens });
                for (let token of channel.blackListedTokens) {
                    if (tokens.indexOf(token.contractId.toLowerCase()) !== -1) {
                        //if black/white listed in the sell(cause it's sell) list make it false
                        send = false;
                    }
                }
            } else {
                // console.log({ buy: channel.buyBlackListedTokens });
                for (let token of channel.buyBlackListedTokens) {
                    if (tokens.indexOf(token.contractId.toLowerCase()) !== -1) {
                        //same thing as first send= false, bu this is true sell, and the first one is fake buy(means it's listed as buy cause customer wants it to.)
                        send = false;
                    }
                }
            }
        }
        console.log({ send2: send });
        if (channel.type === CHANNEL_BLACK_LIST_TYPE.WHITELIST) {
            //send is false if there is no message in the first place so, u really should'nt send
            if (message) {
                //but in case send is false and there is a message it means the token is registered in the list and we know the channel type is whitelist, which means we only send whitelisted tokens and nothing else
                //which means only if there is message and send is false, then send the mesage
                if (!send) {
                    await bot.telegram.sendMessage(
                        `${channel.channelId}`,
                        // process.env.GROUP_ID,
                        message,
                        {
                            // reply_to_message_id: foundPending.telegramSentMessageId,
                            // allow_sending_without_reply: true,
                            disable_web_page_preview: true,
                        }
                    );
                }
            }
        } else {
            if (send) {
                await bot.telegram.sendMessage(
                    `${channel.channelId}`,
                    // process.env.GROUP_ID,
                    message,
                    {
                        // reply_to_message_id: foundPending.telegramSentMessageId,
                        // allow_sending_without_reply: true,
                        disable_web_page_preview: true,
                    }
                );
            }
        }
    }
};

/**
 * gets new completed transaction webhook, this is purely used for transactions not early registered as pending from mev protection issue
 * if tx was pending, leave it alone, else send to the processCompleted function
 * {
  removed: false,
  transaction: {
    blockNumber: '0x7fcf54',
    blockHash: '0x43d166425cb16989a3e19a7c1c19dbff1acd1cd1597a906a9bb01904e80a9193',
    from: '0xc5873c20f52755ee6e7ceb5b5de2ce2c57ecdb74',
    to: '0x628254f7513e02865ad6cd4a407dea5b5da55012',
    input: '0x',
    gas: '0x5208',
    gasPrice: '0x59688468',
    nonce: '0x2',
    transactionIndex: '0x10',
    value: '0x38d7ea4c68000',
    type: '0x2',
    v: '0x1',
    r: '0x42b7db7f9d282cbb4a33acae3c1b4f181aaae8fdb4fc1b7a46c285360fbd370d',
    s: '0x195f5dda78f843ebdd4cf358612e60268ffed79dbfa50a253132dc52af05f10d',
    hash: '0x8c7c17a5b37fd447ebd42a85deaff6549bd7ecd44a4211c54766fbd73aaba6ca',
    chainId: '0xaa36a7',
    maxPriorityFeePerGas: '0x59682f00',
    maxFeePerGas: '0x59689cda',
    yParity: '0x1',
    accessList: []
  }
}
    * @param {{
        removed: boolean,
        transaction: {
            blockNumber: string,
            blockHash: string,
            from: string,
            to: string,
            input: string,
            gas: string,
            gasPrice: string,
            nonce: string,
            transactionIndex: string,
            value: string,
            type: string,
            v: string,
            r: string,
            s: string,
            hash: string,
            chainId: string,
            maxPriorityFeePerGas: string,
            maxFeePerGas: string,
            yParity: string,
            accessList: Array<string>,
        },
    }} data
 */
const processCompletedFromSubscription = async (data, toOrFrom) => {
    const txn = data.transaction;
    const hash = txn.hash;
    const alreadyTx = await prisma.pendingTransactions.findFirst({
        where: { transactionHash: { equals: hash, mode: "insensitive" } },
    });
    logger.info({
        type: "COMPLETED_FROM_SUBSCRIPTION",
        trace: "/services/index.js - line number 374",
        found: hash,
        alreadyTx,
    });
    if (alreadyTx) {
        // wasn't mev protected, so don't process it
        console.log("wasn't mev protected, so don't process it");
        return;
    }
    const wasPendingButDeleted =
        await prisma.deletedPendingTransactions.findFirst({
            where: { transactionHash: { equals: hash, mode: "insensitive" } },
        });
    if (wasPendingButDeleted) {
        // wasn't mev protected, was just already found by etherscan and deleted
        console.log(
            "wasn't mev protected, was just already found by etherscan"
        );
        return;
    }
    if (toOrFrom === "to") {
        const wallet = await prisma.account.findFirst({
            where: {
                account: {
                    equals: txn.to,
                    mode: "insensitive",
                },
            },
        });
        if (!wallet) {
            logger.info({
                errorMessage:
                    "wallet not found for completed from subscription(to)",
                txn,
                wallet,
            });
            return;
        }
        // const lastTransaction = await getLastTransaction(
        //     wallet.account,
        //     txn.hash.toLowerCase()
        // );
        // return processCompleted(lastTransaction, wallet, true);
        await prisma.account.update({
            where: { id: wallet.id },
            data: {
                pendingTransactions: {
                    create: {
                        transactionHash: txn.hash,
                        telegramSentMessageId: 1,
                        mevProtected: true,
                    },
                },
            },
        });
    } else {
        const wallet = await prisma.account.findFirst({
            where: {
                account: {
                    equals: txn.from,
                    mode: "insensitive",
                },
            },
        });
        if (!wallet) {
            logger.info({
                errorMessage:
                    "wallet not found for completed from subscription(from)",
                txn,
                wallet,
            });
            return;
        }
        await prisma.account.update({
            where: { id: wallet.id },
            data: {
                pendingTransactions: {
                    create: {
                        transactionHash: txn.hash,
                        telegramSentMessageId: 1,
                        mevProtected: true,
                    },
                },
            },
        });
    }
};

/**
 * gets all wallets with pending tx and checks if transaction is complete,
 * and if complete it will send it to the appropriate page and deletes the pending tx
 */
const intervalFunction = async () => {
    try {
        const wallets = await prisma.account.findMany({
            include: {
                pendingTransactions: {
                    orderBy: { telegramSentMessageId: "asc" },
                },
            },
        });
        for (let wallet of wallets) {
            if (!wallet.pendingTransactions.length) {
                continue;
            }
            // console.log(wallet.pendingTransactions);
            const firstPendingTransaciton = wallet.pendingTransactions[0];
            const pendingsZero =
                firstPendingTransaciton.transactionHash.toLowerCase();

            // for (let i in pendings) {
            const lastTransaction = await getLastTransaction(
                wallet.account,
                pendingsZero
            );
            if (!lastTransaction) {
                if (wallet.pendingTransactions[0].telegramSentMessageId < 10) {
                    await prisma.pendingTransactions.update({
                        where: {
                            transactionHash_accountId: {
                                transactionHash: pendingsZero,
                                accountId: wallet.id,
                            },
                        },
                        data: {
                            telegramSentMessageId: {
                                increment: 1,
                            },
                        },
                    });
                } else {
                    await prisma.pendingTransactions.deleteMany({
                        where: {
                            transactionHash: pendingsZero,
                        },
                    });
                    logger.info({
                        message: "Give up on pending",
                        hash: pendingsZero,
                    });
                }
                console.log("no data found for", pendingsZero);
                continue;
            }
            // console.log({ lastTransaction });

            //remove it from pending
            //increment the processing value by one and if it was 0,10,20,30 then continue, if not don't!
            console.log("error", lastTransaction.isError);
            try {
                const incrementedProcessingValue =
                    await prisma.pendingTransactions.update({
                        where: {
                            id: firstPendingTransaciton.id,
                        },
                        data: {
                            processing: {
                                increment: 1,
                            },
                        },
                    });
                console.log({
                    incrementedProcessingValue:
                        incrementedProcessingValue.processing,
                });
                if (incrementedProcessingValue.processing % 10 !== 1) {
                    return console.log(
                        "stopped processing cause processing now is",
                        incrementedProcessingValue.processing
                    );
                }
            } catch (e) {
                return console.log(
                    "stopped processing cause processing now has failed(message already sent so it's already deleted)"
                );
            }
            let messageConstructed = true;
            if (lastTransaction?.isError === "0") {
                messageConstructed = await processCompleted(
                    lastTransaction,
                    wallet,
                    firstPendingTransaciton.mevProtected
                );
            }
            //if message not constructed set the value to 0 cause next interval should reprocess, if constructed it's deleted so no worries
            if (messageConstructed === false) {
                await prisma.pendingTransactions.update({
                    where: {
                        id: firstPendingTransaciton.id,
                    },
                    data: {
                        processing: 0,
                    },
                });
                logger.info({
                    errorMessage: "message not constructed",
                    lastTransaction: lastTransaction.hash,
                });
                //message construction failure should skip delete and then retry later cause it's obviously network issues
                console.log("message not constructed", lastTransaction.hash);
            } else {
                logger.info({
                    hash: lastTransaction.hash,
                    success: true,
                    deleted: true,
                });
                await prisma.pendingTransactions.deleteMany({
                    where: {
                        transactionHash: lastTransaction.hash,
                    },
                });
                try {
                    await prisma.deletedPendingTransactions.create({
                        data: {
                            transactionHash: lastTransaction.hash,
                        },
                    });
                } catch (e) {
                    // do nothing tbh
                }
            }

            // break;
            // }
        }
    } catch (e) {
        console.log("set - interval", e);
    }
};
module.exports = {
    processCompleted,
    processPending,
    intervalFunction,
    processCompletedFromSubscription,
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
