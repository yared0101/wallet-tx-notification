const { session, markups, minTime, defaultTime, prisma } = require("../config");
// const { processPending } = require("../services");
const {
    formatSendTokens,
    // formatSendWallets,
    // formatSendPending,
    // formatSendComplete,
    reply,
} = require("../utils");
// const { getLastTransaction, subscribe } = require("../utils/cryptoFunctions");
/**
 *
 * @param {import("telegraf").Composer} bot
 */
module.exports = (bot) => {
    bot.command("start", async (ctx) => {
        session[ctx.chat.id] = {};
        await reply(ctx, "Choose one of the buttons", markups.homeMarkup);
    });
    // bot.command("walletadd", async (ctx) => {
    //     try {
    //         const account = ctx.message.text.split(" ")[1];
    //         let nameTag = ctx.message.text.split(" ")[2];
    //         if (!account) {
    //             return await reply(ctx,
    //                 "Please send address next to the command like /walletAdd 0x... nametag"
    //             );
    //         }
    //         if (!nameTag) {
    //             return await reply(ctx,
    //                 "Please send name tag next to the wallet like /walletAdd 0x... nametag"
    //             );
    //         }
    //         let fullArray = ctx.message.text.split(" ");
    //         fullArray.shift();
    //         fullArray.shift();
    //         nameTag = fullArray.join(" ");
    //         if (!(account[0] === "0" && account[1] === "x")) {
    //             reply(ctx,"please send a proper wallet that starts with 0x");
    //             return;
    //         }
    //         await reply(ctx,"... processing address");

    //         const prev = await prisma.account.findUnique({
    //             where: { account },
    //         });
    //         if (prev) {
    //             reply(ctx,"wallet already exists");
    //             return;
    //         }
    //         const data = await getLastTransaction(account);
    //         if (!data?.hash) {
    //             return await reply(ctx,
    //                 "couldn't get last transaction of wallet, please try again"
    //             );
    //         }
    //         await prisma.account.create({
    //             data: {
    //                 account,
    //                 dataComplete: "COMPLETE",
    //                 lastTransactionTimeStamp: data.hash,
    //                 nameTag,
    //             },
    //         });
    //         subscribe(processPending);

    //         await reply(ctx,`wallet \n${nameTag}\nadded to list successfully`);
    //     } catch (e) {
    //         console.log(e);
    //         return;
    //     }
    // });
    // bot.command("walletlist", async (ctx) => {
    //     try {
    //         await reply(ctx,
    //             formatSendWallets(
    //                 await prisma.account.findMany({
    //                     orderBy: { account: "asc" },
    //                 })
    //             )
    //         );
    //     } catch (e) {
    //         await reply(ctx,"something went wrong");
    //     }
    // });
    // bot.command("walletremove", async (ctx) => {
    //     try {
    //         const index = parseInt(ctx.message.text.split(" ")[1]);
    //         if (!index) {
    //             return await reply(ctx,
    //                 "Please send index to delete next to the command like /walletRemove 2"
    //             );
    //         }
    //         const wallets = await prisma.account.findMany({
    //             orderBy: { account: "asc" },
    //         });
    //         if (!wallets.length) {
    //             return await reply(ctx,`there are no registered wallets!`);
    //         }
    //         if (index < 1 || index > wallets.length) {
    //             return await reply(ctx,
    //                 `please send number between 1 and ${wallets.length}`
    //             );
    //         }
    //         const deletedList = await prisma.account.update({
    //             where: { id: wallets[index - 1].id },
    //             data: {
    //                 pendingTransactions: {
    //                     deleteMany: {},
    //                 },
    //             },
    //         });
    //         const deleted = await prisma.account.delete({
    //             where: { id: wallets[index - 1].id },
    //         });
    //         subscribe(processPending);
    //         await reply(ctx,
    //             `wallet \n${deleted.nameTag}\n removed successfully`
    //         );
    //     } catch (e) {
    //         console.log(e);
    //         reply(ctx,"something went wrong");
    //     }
    // });
    bot.command("tokenadd", async (ctx) => {
        try {
            const token = ctx.message.text.split(" ")[1];
            if (!token) {
                return await reply(
                    ctx,
                    "Please send token next to the command like /tokenAdd 0x..."
                );
            }
            if (!(token[0] === "0" && token[1] === "x")) {
                return await reply(
                    ctx,
                    "please send a proper token that starts with 0x"
                );
            }
            const prev = await prisma.blackListContracts.findUnique({
                where: { contractId: token },
            });
            if (prev) {
                return await reply(ctx, "token already in black list");
            }
            await prisma.blackListContracts.create({
                data: {
                    contractId: token,
                },
            });
            await reply(
                ctx,
                `Token \n${token}\n added to black list successfully`
            );
        } catch (e) {
            console.log(e);
            return;
        }
    });
    bot.command("tokenlist", async (ctx) => {
        try {
            await reply(
                ctx,
                formatSendTokens(
                    await prisma.blackListContracts.findMany({
                        orderBy: { contractId: "asc" },
                    })
                )
            );
        } catch (e) {
            console.log(e);
            await reply(ctx, "something went wrong");
        }
    });
    bot.command("tokenremove", async (ctx) => {
        try {
            const index = parseInt(ctx.message.text.split(" ")[1]);
            if (!index) {
                return await reply(
                    ctx,
                    "Please send index next to the command like /tokenRemove 2"
                );
            }
            const tokens = await prisma.blackListContracts.findMany({
                orderBy: { contractId: "asc" },
            });
            if (!tokens.length) {
                await reply(ctx, `there are no registered wallets!`);
                return;
            }
            if (index < 1 || index > tokens.length) {
                await reply(
                    ctx,
                    `please send number between 1 and ${tokens.length}`
                );
                return;
            }
            const deleted = await prisma.blackListContracts.delete({
                where: { id: tokens[index - 1].id },
            });
            await reply(
                ctx,
                `token ${deleted.contractId} removed successfully`
            );
        } catch (e) {
            console.log(e);
            reply(ctx, "something went wrong");
        }
    });
    bot.command("changetime", async (ctx) => {
        const time = parseInt(ctx.message.text.split(" ")[1]);
        if (isNaN(time)) {
            return reply(ctx, "please send number after change time command");
        }
        if (time < minTime) {
            return reply(ctx, `time can't be less than ${minTime}`);
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
            reply(
                ctx,
                `time changed from ${timeData.totalTime} sec to ${time} sec`
            );
        } else {
            await prisma.time.create({
                data: {
                    totalTime: time,
                },
            });
            await reply(
                ctx,
                `time changed from default ${defaultTime} sec to ${time} sec`
            );
        }
    });
    // bot.command("sendcomplete", async (ctx) => {
    //     const sendC = ctx.message.text.split(" ")[1];
    //     if (!sendC) {
    //         return reply(ctx,
    //             "please send true or false after /sendComplete command"
    //         );
    //     }
    //     if (!sendC.match(/(true|false)$/i)) {
    //         return reply(ctx,
    //             `please send either true or false. false will disable completed messages!`
    //         );
    //     }
    //     const timeData = await prisma.time.findFirst();
    //     if (timeData) {
    //         await prisma.time.update({
    //             where: {
    //                 id: timeData.id,
    //             },
    //             data: {
    //                 sendComplete: sendC === "true" ? true : false,
    //             },
    //         });
    //         reply(ctx,
    //             `configuration changed to ${
    //                 sendC === "true"
    //                     ? "send complete transactions"
    //                     : "dont send complete transactions"
    //             }`
    //         );
    //     } else {
    //         await prisma.time.create({
    //             data: {
    //                 totalTime: defaultTime,
    //                 sendComplete: sendC === "true" ? true : false,
    //             },
    //         });
    //         reply(ctx,
    //             `configuration set to ${
    //                 sendC === "true"
    //                     ? "send complete transactions"
    //                     : "dont send complete transactions"
    //             }`
    //         );
    //     }
    // });
};
