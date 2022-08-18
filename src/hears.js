const { displayStrings, session, markups, prisma } = require("../config");
const { formatSendWallets, formatSendChannels } = require("../utils");
/**
 *
 * @param {import("telegraf").Composer} bot
 */
module.exports = (bot) => {
    bot.hears(displayStrings.home, async (ctx) => {
        session[ctx.chat.id] = {};
        await ctx.reply("Choose one of the buttons", markups.homeMarkup);
    });
    bot.hears(displayStrings.addChannel, async (ctx) => {
        session[ctx.chat.id] = { [displayStrings.addChannel]: {} };
        await ctx.reply(
            "please forward a message from the channel(add me as an admin)"
        );
    });
    bot.hears(displayStrings.addWallet, async (ctx) => {
        session[ctx.chat.id] = { [displayStrings.addWallet]: {} };
        await ctx.reply("please send wallet number");
    });
    bot.hears(displayStrings.removeWallet, async (ctx) => {
        try {
            const wallets = await prisma.account.findMany({
                orderBy: { account: "asc" },
            });
            session[ctx.chat.id] = {
                [displayStrings.removeWallet]: {
                    wallets: wallets,
                },
            };
            await ctx.reply(formatSendWallets(wallets));
            await ctx.reply("please send wallet number from the list");
        } catch (e) {}
    });
    bot.hears(displayStrings.listWallets, async (ctx) => {
        await listWallets(ctx);
    });
    bot.hears(displayStrings.listChannels, async (ctx) => {
        await listChannels(ctx);
    });
    bot.hears(displayStrings.selectChannel, async (ctx) => {
        await selectChannel(ctx);
    });
    bot.hears(
        displayStrings.channelSelected.addWalletToChannel,
        async (ctx) => {
            if (!session[ctx.chat.id]?.selectedChannelId) {
                await ctx.reply(
                    "no channel has been selected to add wallet to, please select channel"
                );
                return await selectChannel(ctx);
            }
            try {
                const wallets = await prisma.account.findMany({
                    where: {
                        channel: {
                            none: {
                                channelId:
                                    session[ctx.chat.id]?.selectedChannelId,
                            },
                        },
                    },
                    orderBy: { account: "asc" },
                });
                session[ctx.chat.id].setting = {
                    [displayStrings.channelSelected.addWalletToChannel]: {
                        wallets: wallets,
                    },
                };
                await ctx.reply(formatSendWallets(wallets));
                await ctx.reply("please send wallet number from the list");
            } catch (e) {}
        }
    );
    bot.hears(
        displayStrings.channelSelected.removeWalletFromChannel,
        async (ctx) => {
            if (!session[ctx.chat.id]?.selectedChannelId) {
                await ctx.reply(
                    "no channel has been selected to remove wallet from, please select channel"
                );
                return await selectChannel(ctx);
            }
            try {
                const wallets = await prisma.account.findMany({
                    where: {
                        channel: {
                            some: {
                                channelId:
                                    session[ctx.chat.id]?.selectedChannelId,
                            },
                        },
                    },
                    orderBy: { account: "asc" },
                });
                if (!wallets.length) {
                    return await ctx.reply(
                        `no wallet found in the channel, please use \n${displayStrings.channelSelected.removeWalletFromChannel}\nto add wallet`
                    );
                }
                session[ctx.chat.id].setting = {
                    [displayStrings.channelSelected.removeWalletFromChannel]: {
                        wallets: wallets,
                    },
                };
                await ctx.reply(formatSendWallets(wallets));
                await ctx.reply("please send wallet number from the list");
            } catch (e) {}
        }
    );
    bot.hears(displayStrings.channelSelected.editChannel, async (ctx) => {
        if (!session[ctx.chat.id]?.selectedChannelId) {
            await ctx.reply(
                "no channel has been selected to add channel to, please select channel"
            );
            return await selectChannel(ctx);
        }
        session[ctx.chat.id] = {
            [displayStrings.channelSelected.editChannel]: {},
        };
        await ctx.reply("please send channel name");
    });
    bot.hears(displayStrings.channelSelected.channelSettings, async (ctx) => {
        if (!session[ctx.chat.id]?.selectedChannelId) {
            await ctx.reply(
                "no channel has been selected, please select channel"
            );
            return await selectChannel(ctx);
        }
        const channel = await prisma.channel.findFirst({
            where: {
                channelId: session[ctx.chat.id].selectedChannelId,
            },
        });
        await ctx.reply(
            `please toggle settings for channel ${channel.name}`,
            markups.channelSettingsInline(channel)
        );
    });
    bot.hears(
        displayStrings.channelSelected.listWalletsInChannel,
        async (ctx) => {
            try {
                if (!session[ctx.chat.id]?.selectedChannelId) {
                    await ctx.reply(
                        "no channel has been selected to add wallet to, please select channel"
                    );
                    return await selectChannel(ctx);
                }
                await ctx.reply(
                    formatSendWallets(
                        await prisma.account.findMany({
                            orderBy: { account: "asc" },
                            where: {
                                channel: {
                                    some: {
                                        channelId:
                                            session[ctx.chat.id]
                                                .selectedChannelId,
                                    },
                                },
                            },
                        })
                    )
                );
            } catch (e) {
                await ctx.reply("something went wrong");
            }
        }
    );
};
/**
 *
 * @param {import('telegraf').Context} ctx
 */
const selectChannel = async (ctx) => {
    try {
        const channels = await prisma.channel.findMany({
            orderBy: { channelId: "asc" },
        });
        const message = formatSendChannels(channels);
        const mark = markups.selectChannelMarkup(channels);
        await ctx.reply(message, mark);
    } catch (e) {
        await ctx.reply("something went wrong");
    }
};
/**
 *
 * @param {import('telegraf').Context} ctx
 */
const listChannels = async (ctx) => {
    try {
        await ctx.reply(
            formatSendChannels(
                await prisma.channel.findMany({
                    orderBy: { channelId: "asc" },
                })
            )
        );
    } catch (e) {
        await ctx.reply("something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 */
const listWallets = async (ctx) => {
    try {
        await ctx.reply(
            formatSendWallets(
                await prisma.account.findMany({
                    orderBy: { account: "asc" },
                })
            )
        );
    } catch (e) {
        await ctx.reply("something went wrong");
    }
};
