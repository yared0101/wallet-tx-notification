const { default: axios } = require("axios");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
require("dotenv").config();
// const { Telegraf } = require("telegraf");
// const bot = new Telegraf(process.env.BOT_TOKEN);

const { Composer } = require("micro-bot");
const bot = new Composer();
bot.init = async (mBot) => {
    bot.telegram = mBot.telegram;
};

const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(process.env.ALCHEMY_WEBSOCKET);
// this variable is in memory as long as the server is running, which means we can store subscription object here
// and then unsubscribe when new addresses are added, to subscribe to the new addresses too!
// if server not running it means socket connection is lost so that's good enough
var subscription = [];
const {
    formatSendTokens,
    formatSendWallets,
    formatSendPending,
    formatSendComplete,
} = require("./utils");
const apiKey = process.env.API_KEY;
// const address = "0x628254F7513e02865AD6cD4A407dea5B5Da55012";
const url = process.env.MAIN_NET_URL;
const baseUrl = process.env.MAIN_BASE_NET_URL;
// const url = process.env.GOERLI_NET_URL;
// const baseUrl = process.env.GOERLI_BASE_NET_URL;

const getLastTransaction = async (address) => {
    if (!address) {
        return undefined;
    }
    try {
        const data = await axios.get(
            `${url}/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${apiKey}`
        );
        const lastTransaction = data.data.result[0];
        return lastTransaction;
    } catch (e) {
        console.log(e.message);
        return undefined;
    }
};
/**
 *
 * @param {string} address
 * @param {string} hash
 * @returns
 */
const erc20TokenTransferEvents = async (address, hash) => {
    try {
        const data = await axios.get(
            `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&page=1&offset=100&startblock=0&endblock=27025780&sort=desc&apikey=${apiKey}`
        );
        const transferredToken = data.data.result.find(
            (elem) => elem.hash.toLowerCase() === hash.toLowerCase()
        );
        return transferredToken;
    } catch (e) {
        console.log(e);
        return undefined;
    }
};
/**
 *
 * @param {string} transaction
 * @param {string} targetAcc
 * @returns
 */
const getInternalTransaction = async (transaction, targetAcc) => {
    try {
        const data = await axios.get(
            `https://api.etherscan.io/api?module=account&action=txlistinternal&txhash=${transaction}&apikey=${apiKey}`
        );
        try {
            return data.data.result.find(
                (elem) => elem.to.toLowerCase() === targetAcc.toLowerCase()
            );
        } catch (e) {
            console.log("internal find", e);
            return undefined;
        }
    } catch (e) {
        console.log("internal out", e);
        return undefined;
    }
};

const minTime = 2;
const defaultTime = 5;
bot.command("walletadd", async (ctx) => {
    try {
        const account = ctx.message.text.split(" ")[1];
        let nameTag = ctx.message.text.split(" ")[2];
        if (!account) {
            return await ctx.reply(
                "Please send address next to the command like /walletAdd 0x... nametag"
            );
        }
        if (!nameTag) {
            return await ctx.reply(
                "Please send name tag next to the wallet like /walletAdd 0x... nametag"
            );
        }
        let fullArray = ctx.message.text.split(" ");
        fullArray.shift();
        fullArray.shift();
        nameTag = fullArray.join(" ");
        if (!(account[0] === "0" && account[1] === "x")) {
            ctx.reply("please send a proper wallet that starts with 0x");
            return;
        }
        await ctx.reply("... processing address");

        const prev = await prisma.account.findUnique({ where: { account } });
        if (prev) {
            ctx.reply("wallet already exists");
            return;
        }
        const data = await getLastTransaction(account);
        if (!data?.hash) {
            return await ctx.reply(
                "couldn't get last transaction of wallet, please try again"
            );
        }
        await prisma.account.create({
            data: {
                account,
                dataComplete: "COMPLETE",
                lastTransactionTimeStamp: data.hash,
                nameTag,
            },
        });
        subscribe();

        await ctx.reply(`wallet \n${nameTag}\n added to list successfully`);
    } catch (e) {
        console.log(e);
        return;
    }
});
bot.command("walletlist", async (ctx) => {
    try {
        await ctx.reply(
            formatSendWallets(
                await prisma.account.findMany({ orderBy: { account: "asc" } })
            )
        );
    } catch (e) {
        await ctx.reply("something went wrong");
    }
});
bot.command("walletremove", async (ctx) => {
    try {
        const index = parseInt(ctx.message.text.split(" ")[1]);
        if (!index) {
            return await ctx.reply(
                "Please send index to delete next to the command like /walletRemove 2"
            );
        }
        const wallets = await prisma.account.findMany({
            orderBy: { account: "asc" },
        });
        if (!wallets.length) {
            return await ctx.reply(`there are no registered wallets!`);
        }
        if (index < 1 || index > wallets.length) {
            return await ctx.reply(
                `please send number between 1 and ${wallets.length}`
            );
        }
        const deletedList = await prisma.account.update({
            where: { id: wallets[index - 1].id },
            data: {
                pendingTransactions: {
                    deleteMany: {},
                },
            },
        });
        const deleted = await prisma.account.delete({
            where: { id: wallets[index - 1].id },
        });
        subscribe();
        await ctx.reply(`wallet \n${deleted.nameTag}\n removed successfully`);
    } catch (e) {
        console.log(e);
        ctx.reply("something went wrong");
    }
});
bot.command("tokenadd", async (ctx) => {
    try {
        const token = ctx.message.text.split(" ")[1];
        if (!token) {
            return await ctx.reply(
                "Please send token next to the command like /tokenAdd 0x..."
            );
        }
        if (!(token[0] === "0" && token[1] === "x")) {
            return await ctx.reply(
                "please send a proper token that starts with 0x"
            );
        }
        const prev = await prisma.blackListContracts.findUnique({
            where: { contractId: token },
        });
        if (prev) {
            return await ctx.reply("token already in black list");
        }
        await prisma.blackListContracts.create({
            data: {
                contractId: token,
            },
        });
        await ctx.reply(`Token \n${token}\n added to black list successfully`);
    } catch (e) {
        console.log(e);
        return;
    }
});
bot.command("tokenlist", async (ctx) => {
    try {
        await ctx.reply(
            formatSendTokens(
                await prisma.blackListContracts.findMany({
                    orderBy: { contractId: "asc" },
                })
            )
        );
    } catch (e) {
        console.log(e);
        await ctx.reply("something went wrong");
    }
});
bot.command("tokenremove", async (ctx) => {
    try {
        const index = parseInt(ctx.message.text.split(" ")[1]);
        if (!index) {
            return await ctx.reply(
                "Please send index next to the command like /tokenRemove 2"
            );
        }
        const tokens = await prisma.blackListContracts.findMany({
            orderBy: { contractId: "asc" },
        });
        if (!tokens.length) {
            await ctx.reply(`there are no registered wallets!`);
            return;
        }
        if (index < 1 || index > tokens.length) {
            await ctx.reply(
                `please send number between 1 and ${tokens.length}`
            );
            return;
        }
        const deleted = await prisma.blackListContracts.delete({
            where: { id: tokens[index - 1].id },
        });
        await ctx.reply(`token ${deleted.contractId} removed successfully`);
    } catch (e) {
        console.log(e);
        ctx.reply("something went wrong");
    }
});
bot.command("changetime", async (ctx) => {
    const time = parseInt(ctx.message.text.split(" ")[1]);
    if (isNaN(time)) {
        return ctx.reply("please send number after change time command");
    }
    if (time < minTime) {
        return ctx.reply(`time can't be less than ${minTime}`);
    }
    const timeData = await prisma.time.findFirst();
    if (timeData) {
        await prisma.time.update({
            where: {
                id: timeData.id,
            },
            data: {
                totalTime: time,
            },
        });
        ctx.reply(`time changed from ${timeData.totalTime} sec to ${time} sec`);
    } else {
        await prisma.time.create({
            data: {
                totalTime: time,
            },
        });
        await ctx.reply(
            `time changed from default ${defaultTime} sec to ${time} sec`
        );
    }
});
bot.command("sendcomplete", async (ctx) => {
    const sendC = ctx.message.text.split(" ")[1];
    if (!sendC) {
        return ctx.reply(
            "please send true or false after /sendComplete command"
        );
    }
    if (!sendC.match(/(true|false)$/i)) {
        return ctx.reply(
            `please send either true or false. false will disable completed messages!`
        );
    }
    const timeData = await prisma.time.findFirst();
    if (timeData) {
        await prisma.time.update({
            where: {
                id: timeData.id,
            },
            data: {
                sendComplete: sendC === "true" ? true : false,
            },
        });
        ctx.reply(
            `configuration changed to ${
                sendC === "true"
                    ? "send complete transactions"
                    : "dont send complete transactions"
            }`
        );
    } else {
        await prisma.time.create({
            data: {
                totalTime: defaultTime,
                sendComplete: sendC === "true" ? true : false,
            },
        });
        ctx.reply(
            `configuration set to ${
                sendC === "true"
                    ? "send complete transactions"
                    : "dont send complete transactions"
            }`
        );
    }
});
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
    try {
        console.log({ txn });
        const account1 = prisma.account.findFirst({
            where: {
                account: {
                    equals: txn.to,
                    mode: "insensitive",
                },
            },
            include: {
                pendingTransactions: true,
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
            const sent = await bot.telegram.sendMessage(
                process.env.USER_ID,
                message,
                {
                    disable_web_page_preview: true,
                }
            );
            await prisma.account.update({
                where: { id: account.id },
                data: {
                    pendingTransactions: {
                        create: {
                            transactionHash: txn.hash,
                            telegramSentMessageId: sent.message_id,
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
    const extraData =
        isSell && (await getInternalTransaction(txn.hash, wallet.account));
    const tokenData = await erc20TokenTransferEvents(wallet.account, txn.hash);
    console.log({ extraData, tokenData });
    await bot.telegram.sendMessage(
        // process.env.USER_ID,
        process.env.GROUP_ID,
        formatSendComplete(
            txn,
            wallet,
            baseUrl,
            isSell && extraData?.value,
            tokenData
        ),
        {
            // reply_to_message_id: foundPending.telegramSentMessageId,
            // allow_sending_without_reply: true,
            disable_web_page_preview: true,
        }
    );
};
/**
 *
 * @param {string} contractAddress all in small
 * @param {import("@prisma/client").BlackListContracts[]} tokens
 * @param {import("@prisma/client").PendingTransactions} pendingData
 */
const isBlackListed = (contractAddress, tokens, pendingData) => {
    const addressesArray = tokens.map((elem) => elem.contractId.toLowerCase());
    const foundIndex = addressesArray.indexOf(contractAddress);
    if (foundIndex === -1) {
        return false;
    } else {
        try {
            bot.telegram.sendMessage(
                process.env.USER_ID,
                "BlackListed Transaction",
                {
                    reply_to_message_id: pendingData.telegramSentMessageId,
                    allow_sending_without_reply: true,
                    disable_notification: true,
                }
            );
        } catch (e) {}
        return true;
    }
};

const subscribe = async () => {
    try {
        await subscription?.[0]?.unsubscribe();
        await subscription?.[1]?.unsubscribe();
        const wallets = await prisma.account.findMany();
        if (wallets.length) {
            subscription[0] = web3.eth
                .subscribe("alchemy_pendingTransactions", {
                    fromAddress: wallets.map((elem) => elem.account),
                    hashesOnly: false,
                })
                .on("data", (data) => {
                    processPending(data);
                });
            subscription[1] = web3.eth
                .subscribe("alchemy_pendingTransactions", {
                    toAddress: wallets.map((elem) => elem.account),
                    hashesOnly: false,
                })
                .on("data", (data) => {
                    processPending(data);
                });
            console.log("in", subscription);
        }
        console.log("out", subscription);
    } catch (e) {
        console.log("subscribe", e);
    }
};
const main = async () => {
    const configData = await prisma.time.findFirst();
    const setTime = configData?.totalTime;
    await subscribe();
    setInterval(async () => {
        try {
            const configData = await prisma.time.findFirst();
            let sendCommplete = configData?.sendComplete;
            if (sendCommplete === undefined) {
                sendCommplete = true;
            }
            const wallets = await prisma.account.findMany({
                include: { pendingTransactions: true },
            });
            const tokens = await prisma.blackListContracts.findMany();
            for (let wallet of wallets) {
                if (!wallet.pendingTransactions.length) {
                    continue;
                }
                const lastTransaction = await getLastTransaction(
                    wallet.account
                );
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
                    if (data || !sendCommplete) {
                        continue;
                    } else {
                        if(lastTransaction?.isError === '0'){
                            processCompleted(lastTransaction, wallet);
                        }
                    }
                }
            }
        } catch (e) {
            console.log("set - interval", e);
        }
    }, (setTime || defaultTime) * 1000);
};
main();
// bot.launch();
module.exports = bot;
console.log("started");
