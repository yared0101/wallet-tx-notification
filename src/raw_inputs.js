const { session, prisma, markups, displayStrings } = require("../config");
const { processPending } = require("../services");
const { formatSendDetailChannel } = require("../utils");
const { subscribe, getLastTransaction } = require("../utils/cryptoFunctions");

/**
 *
 * @param {import("telegraf").Telegraf} bot
 */
module.exports = (bot) => {
    bot.use(async (ctx) => {
        if (ctx.message && ctx.message.text) {
            try {
                if (session[ctx.chat.id]?.[displayStrings.addChannel]) {
                    await addChannel(ctx);
                } else if (session[ctx.chat.id]?.[displayStrings.addWallet]) {
                    await addWallet(ctx, ctx.message.text);
                } else if (
                    session[ctx.chat.id]?.[displayStrings.removeWallet]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await ctx.reply("please send a number value");
                    }
                    await removeWallet(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.removeWalletFromChannel
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await ctx.reply("please send a number value");
                    }
                    await removeWalletFromChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.addWalletToChannel
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await ctx.reply("please send a number value");
                    }
                    await addWalletToChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.editChannel
                    ]
                ) {
                    await addWallet(ctx.message.text); //skipped
                } else {
                    await ctx.reply(
                        "please use one of the buttons",
                        markups.homeMarkup
                    );
                }
            } catch (e) {
                console.log(e);
                await ctx.reply("something went wrong");
            }
        }
    });
};
/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {string} text
 */
const addChannel = async (ctx) => {
    try {
        const sentChannel = ctx?.message?.forward_from_chat;
        if (!sentChannel) {
            return await ctx.reply("please forward a message from the channel");
        }
        if (sentChannel.type !== "channel") {
            return await ctx.reply(
                "the forwarded message must be from a channel"
            );
        }
        const channel = await prisma.channel.create({
            data: {
                channelId: sentChannel.username,
                name: sentChannel.title,
            },
        });
        session[ctx.chat.id] = {
            selectedChannelId: sentChannel.username,
        };
        await ctx.reply(
            formatSendDetailChannel(channel),
            markups.selectedChannel
        );
        await ctx.reply("channel added successfully, please modify settings");
    } catch (e) {
        console.log(e);
        await ctx.reply("something went wrong");
    }
};
/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {string} text
 */
const addWallet = async (ctx, text) => {
    let ses = session[ctx.chat.id][displayStrings.addWallet];
    if (!ses.number) {
        ses.number = text;
        session[ctx.chat.id][displayStrings.addWallet] = ses;
        return await ctx.reply("please send wallet name tag");
    } else if (!ses.nameTag) {
        ses.nameTag = text;
        try {
            const account = ses.number;
            let nameTag = ses.nameTag;
            if (!(account[0] === "0" && account[1] === "x")) {
                ctx.reply("please send a proper wallet that starts with 0x");
                return;
            }
            await ctx.reply("... processing address");

            const prev = await prisma.account.findUnique({
                where: { account },
            });
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
            subscribe(processPending);
            session[ctx.chat.id] = {};
            await ctx.reply(
                `wallet \n${nameTag}\nadded to list successfully`,
                markups.homeMarkup
            );
        } catch (e) {
            console.log(e);
            return;
        }
        //send to one of the commands
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const removeWallet = async (ctx, number) => {
    let ses = session[ctx.chat.id][displayStrings.removeWallet];
    const wallets = ses.wallets;
    try {
        if (number > wallets.length || number < 1) {
            return await ctx.reply(
                `please send number between 1 and ${wallets.length}`
            );
        }
        const deletedWalletId = wallets[number - 1].id;
        await prisma.account.delete({
            where: {
                id: deletedWalletId,
            },
        });
        session[ctx.chat.id] = {};
        await ctx.reply(
            "wallet removed from channel successfully",
            markups.homeMarkup
        );
    } catch (e) {
        console.log(e);
        return await ctx.reply("something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const removeWalletFromChannel = async (ctx, number) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.removeWalletFromChannel
        ];
    const wallets = ses.wallets;
    try {
        if (number > wallets.length || number < 1) {
            return await ctx.reply(
                `please send number between 1 and ${wallets.length}`
            );
        }
        const deletedWalletId = wallets[number - 1].id;
        const removedFromChannelId = session[ctx.chat.id].selectedChannelId;
        const channel = await prisma.channel.findFirst({
            where: { channelId: removedFromChannelId },
        });
        await prisma.account.update({
            where: {
                id: deletedWalletId,
            },
            data: {
                channel: {
                    disconnect: { id: channel.id },
                },
            },
        });
        session[ctx.chat.id].setting = {};
        await ctx.reply(
            "wallet removed from channel successfully",
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await ctx.reply("something went wrong");
    }
};
/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const addWalletToChannel = async (ctx, number) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.addWalletToChannel
        ];
    const wallets = ses.wallets;
    try {
        if (number > wallets.length || number < 1) {
            return await ctx.reply(
                `please send number between 1 and ${wallets.length}`
            );
        }
        const deletedWalletId = wallets[number - 1].id;
        const addedToChannelId = session[ctx.chat.id].selectedChannelId;
        const channel = await prisma.channel.findFirst({
            where: { channelId: addedToChannelId },
        });
        await prisma.account.update({
            where: {
                id: deletedWalletId,
            },
            data: {
                channel: {
                    connect: { id: channel.id },
                },
            },
        });
        session[ctx.chat.id].setting = {};
        await ctx.reply(
            "wallet added to channel successfully",
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await ctx.reply("something went wrong");
    }
};
