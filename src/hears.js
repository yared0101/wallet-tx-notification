const { displayStrings, session, markups, prisma } = require("../config");
const {
    formatSendWallets,
    formatSendChannels,
    formatSendTokens,
} = require("../utils");
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
        await ctx.reply("please send wallet address");
    });
    bot.hears(displayStrings.removeWallet, async (ctx) => {
        try {
            const wallets = await prisma.account.findMany({
                orderBy: { id: "asc" },
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
    bot.hears(displayStrings.removeChannel, async (ctx) => {
        try {
            const channels = await prisma.channel.findMany({
                orderBy: { id: "asc" },
            });
            session[ctx.chat.id] = {
                [displayStrings.removeChannel]: {
                    channels: channels,
                },
            };
            await ctx.reply(formatSendChannels(channels));
            await ctx.reply("please send channel number from the list");
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
                    orderBy: { id: "asc" },
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
                    orderBy: { id: "asc" },
                });
                if (!wallets.length) {
                    return await ctx.reply(
                        `no wallet found in the channel, please use \n${displayStrings.channelSelected.addWalletToChannel}\nto add wallet`
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
    bot.hears(displayStrings.channelSelected.setMinimumEther, async (ctx) => {
        if (!session[ctx.chat.id]?.selectedChannelId) {
            await ctx.reply(
                "no channel has been selected to set minimum ether to, please select channel"
            );
            return await selectChannel(ctx);
        }
        try {
            session[ctx.chat.id].setting = {
                [displayStrings.channelSelected.setMinimumEther]: {},
            };
            await ctx.reply(
                "please send minimum ether value, send 0 to unset minimum value"
            );
        } catch (e) {}
    });
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
                            orderBy: { id: "asc" },
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
    bot.hears(
        displayStrings.channelSelected.viewBlackListToken,
        async (ctx) => {
            try {
                if (!session[ctx.chat.id]?.selectedChannelId) {
                    await ctx.reply(
                        "no channel has been selected to add wallet to, please select channel"
                    );
                    return await selectChannel(ctx);
                }
                await ctx.reply(
                    formatSendTokens(
                        (
                            await prisma.channel.findFirst({
                                where: {
                                    channelId:
                                        session[ctx.chat.id].selectedChannelId,
                                },
                                include: {
                                    blackListedTokens: true,
                                },
                            })
                        )?.blackListedTokens
                    )
                );
            } catch (e) {
                console.log(e);
                await ctx.reply("something went wrong");
            }
        }
    );
    bot.hears(displayStrings.channelSelected.addBlackListToken, async (ctx) => {
        if (!session[ctx.chat.id]?.selectedChannelId) {
            await ctx.reply(
                "no channel has been selected to add token to, please select channel"
            );
            return await selectChannel(ctx);
        }
        try {
            session[ctx.chat.id].setting = {
                [displayStrings.channelSelected.addBlackListToken]: {},
            };
            await ctx.reply("please send token address");
        } catch (e) {}
    });
    bot.hears(
        displayStrings.channelSelected.removeBlackListToken,
        async (ctx) => {
            if (!session[ctx.chat.id]?.selectedChannelId) {
                await ctx.reply(
                    "no channel has been selected to remove token from, please select channel"
                );
                return await selectChannel(ctx);
            }
            try {
                const tokens = (
                    await prisma.channel.findFirst({
                        where: {
                            channelId: session[ctx.chat.id].selectedChannelId,
                        },
                        include: {
                            blackListedTokens: true,
                        },
                    })
                )?.blackListedTokens;
                if (!tokens.length) {
                    return await ctx.reply(
                        `no token found in the channel, please use \n${displayStrings.channelSelected.addBlackListToken}\nto add token to blacklist`
                    );
                }
                session[ctx.chat.id].setting = {
                    [displayStrings.channelSelected.removeBlackListToken]: {
                        tokens,
                    },
                };
                await ctx.reply(formatSendTokens(tokens));
                await ctx.reply("please send token number from the list");
            } catch (e) {}
        }
    );
    bot.hears(
        displayStrings.channelSelected.viewBuyBlackListToken,
        async (ctx) => {
            try {
                if (!session[ctx.chat.id]?.selectedChannelId) {
                    await ctx.reply(
                        "no channel has been selected! please select channel"
                    );
                    return await selectChannel(ctx);
                }
                await ctx.reply(
                    formatSendTokens(
                        (
                            await prisma.channel.findFirst({
                                where: {
                                    channelId:
                                        session[ctx.chat.id].selectedChannelId,
                                },
                                include: {
                                    buyBlackListedTokens: true,
                                },
                            })
                        )?.buyBlackListedTokens
                    )
                );
            } catch (e) {
                console.log(e);
                await ctx.reply("something went wrong");
            }
        }
    );
    bot.hears(
        displayStrings.channelSelected.addBuyBlackListToken,
        async (ctx) => {
            if (!session[ctx.chat.id]?.selectedChannelId) {
                await ctx.reply(
                    "no channel has been selected to add token to, please select channel"
                );
                return await selectChannel(ctx);
            }
            try {
                session[ctx.chat.id].setting = {
                    [displayStrings.channelSelected.addBuyBlackListToken]: {},
                };
                await ctx.reply("please send token address");
            } catch (e) {}
        }
    );
    bot.hears(
        displayStrings.channelSelected.removeBuyBlackListToken,
        async (ctx) => {
            if (!session[ctx.chat.id]?.selectedChannelId) {
                await ctx.reply(
                    "no channel has been selected to remove token from, please select channel"
                );
                return await selectChannel(ctx);
            }
            try {
                const tokens = (
                    await prisma.channel.findFirst({
                        where: {
                            channelId: session[ctx.chat.id].selectedChannelId,
                        },
                        include: {
                            buyBlackListedTokens: true,
                        },
                    })
                )?.buyBlackListedTokens;
                if (!tokens.length) {
                    return await ctx.reply(
                        `no token found in the channel, please use \n${displayStrings.channelSelected.addBuyBlackListToken}\nto add token to blacklist`
                    );
                }
                session[ctx.chat.id].setting = {
                    [displayStrings.channelSelected.removeBuyBlackListToken]: {
                        tokens,
                    },
                };
                await ctx.reply(formatSendTokens(tokens));
                await ctx.reply("please send token number from the list");
            } catch (e) {}
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
            orderBy: { id: "asc" },
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
                    orderBy: { id: "asc" },
                })
            )
        );
    } catch (e) {
        console.log(e);
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
                    orderBy: { id: "asc" },
                })
            )
        );
    } catch (e) {
        await ctx.reply("something went wrong");
    }
};
