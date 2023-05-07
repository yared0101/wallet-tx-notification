const { CHANNEL_BLACK_LIST_TYPE } = require("@prisma/client");
const { session, prisma, markups, displayStrings } = require("../config");
const { processPending } = require("../services");
const { formatSendDetailChannel, reply } = require("../utils");
const {
    subscribe,
    getLastTransaction,
    getTokenInfo,
} = require("../utils/cryptoFunctions");

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
                        return await reply(ctx, "please send a number value");
                    }
                    await removeWallet(ctx, number);
                } else if (
                    session[ctx.chat.id]?.[displayStrings.removeChannel]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await reply(ctx, "please send a number value");
                    }
                    await removeChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.removeWalletFromChannel
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await reply(ctx, "please send a number value");
                    }
                    await removeWalletFromChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.removeBlackListToken
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await reply(ctx, "please send a number value");
                    }
                    await removeTokenFromChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.removeBuyBlackListToken
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await reply(ctx, "please send a number value");
                    }
                    await removeBuyTokenFromChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.setMinimumEther
                    ]
                ) {
                    const number = Number(ctx.message.text);
                    if (isNaN(number) || number < 0) {
                        return await reply(
                            ctx,
                            "please send a number value greater than 0"
                        );
                    }
                    await setMinimumEther(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.addWalletToChannel
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await reply(ctx, "please send a number value");
                    }
                    await addWalletToChannel(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.addBlackListToken
                    ]
                ) {
                    const address = ctx.message.text;
                    await addTokenToChannel(ctx, address);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.fileCompareOptions.addBlackListToken
                    ]
                ) {
                    const address = ctx.message.text;
                    await addTokenToFileBlackList(ctx, address);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.fileCompareOptions.removeBlackListToken
                    ]
                ) {
                    const number = parseInt(ctx.message.text);
                    if (isNaN(number)) {
                        return await reply(ctx, "please send a number value");
                    }
                    await removeTokenFromFileBlacklist(ctx, number);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.addBuyBlackListToken
                    ]
                ) {
                    const address = ctx.message.text;
                    await addBuyTokenToChannel(ctx, address);
                } else if (
                    session[ctx.chat.id]?.setting?.[
                        displayStrings.channelSelected.editChannel
                    ]
                ) {
                    await addWallet(ctx.message.text); //skipped
                } else {
                    await reply(
                        ctx,
                        "please use one of the buttons",
                        session[ctx.chat.id]?.selectedChannelId
                            ? markups.selectedChannel
                            : markups.homeMarkup
                    );
                }
            } catch (e) {
                console.log(e);
                await reply(ctx, "something went wrong");
            }
        } else {
            //when document is sent
            console.log(ctx?.message?.document);
            if (ctx?.message?.document) {
                if (session[ctx.chat.id]?.fileCompare) {
                    if (session[ctx.chat.id]?.fileCompare?.addFile) {
                        if (ctx.message.document.mime_type === "text/csv") {
                            session[ctx.chat.id].fileCompare.files.push(
                                ctx.message.document.file_id
                            );
                            const fileLength =
                                session[ctx.chat.id].fileCompare.files.length;
                            await reply(
                                ctx,
                                `${fileLength} files sent. you can send more files ${
                                    fileLength > 1
                                        ? `or press Display Results to process files`
                                        : ""
                                }`
                            );
                        } else {
                            await reply(ctx, "Please send csv file");
                        }
                    } else {
                        await reply(
                            ctx,
                            `please press ${displayStrings.fileCompareOptions.addFile} to start adding files`,
                            markups.fileCompareMarkup
                        );
                    }
                } else {
                    await reply(
                        ctx,
                        "please use one of the buttons",
                        markups.homeMarkup
                    );
                }
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
            return await reply(
                ctx,
                "please forward a message from the channel"
            );
        }
        if (sentChannel.type !== "channel") {
            return await reply(
                ctx,
                "the forwarded message must be from a channel"
            );
        }
        const channel = await prisma.channel.create({
            data: {
                channelId: `${sentChannel.id}`,
                name: sentChannel.title,
            },
        });
        session[ctx.chat.id] = {
            selectedChannelId: sentChannel.username,
        };
        await reply(
            ctx,
            formatSendDetailChannel(channel),
            markups.selectedChannel
        );
        await reply(ctx, "channel added successfully, please modify settings");
    } catch (e) {
        console.log(e);
        await reply(ctx, "something went wrong");
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
        return await reply(ctx, "please send wallet name tag");
    } else if (!ses.nameTag) {
        ses.nameTag = text;
        try {
            const account = ses.number;
            let nameTag = ses.nameTag;
            if (!(account[0] === "0" && account[1] === "x")) {
                reply(ctx, "please send a proper wallet that starts with 0x");
                return;
            }
            await reply(ctx, "... processing address");

            const prev = await prisma.account.findUnique({
                where: { account },
            });
            if (prev) {
                reply(ctx, `wallet ${prev.nameTag} already exists`);
                return;
            }
            const data = await getLastTransaction(account);
            if (!data?.hash) {
                return await reply(
                    ctx,
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
            await reply(
                ctx,
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
            return await reply(
                ctx,
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
        await reply(ctx, "wallet removed successfully", markups.homeMarkup);
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const removeChannel = async (ctx, number) => {
    let ses = session[ctx.chat.id][displayStrings.removeChannel];
    const channels = ses.channels;
    try {
        if (number > channels.length || number < 1) {
            return await reply(
                ctx,
                `please send number between 1 and ${channels.length}`
            );
        }
        const deletedChannelId = channels[number - 1].id;
        await prisma.channel.delete({
            where: {
                id: deletedChannelId,
            },
        });
        session[ctx.chat.id] = {};
        await reply(ctx, "Channel removed successfully", markups.homeMarkup);
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
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
            return await reply(
                ctx,
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
        await reply(
            ctx,
            "wallet removed from channel successfully",
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const removeTokenFromChannel = async (ctx, number) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.removeBlackListToken
        ];
    const tokens = ses.tokens;
    try {
        if (number > tokens.length || number < 1) {
            return await reply(
                ctx,
                `please send number between 1 and ${tokens.length}`
            );
        }
        const deletedToken = tokens[number - 1];
        const removedFromChannelId = session[ctx.chat.id].selectedChannelId;
        const channel = await prisma.channel.findFirst({
            where: { channelId: removedFromChannelId },
        });
        await prisma.channel.update({
            where: {
                id: channel.id,
            },
            data: {
                blackListedTokens: {
                    delete: {
                        id: deletedToken.id,
                    },
                },
            },
        });
        session[ctx.chat.id].setting = {};
        await reply(
            ctx,
            `token removed from sell ${
                channel.type === CHANNEL_BLACK_LIST_TYPE.WHITELIST
                    ? "white"
                    : "black"
            }list successfully`,
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const removeBuyTokenFromChannel = async (ctx, number) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.removeBuyBlackListToken
        ];
    const tokens = ses.tokens;
    try {
        if (number > tokens.length || number < 1) {
            return await reply(
                ctx,
                `please send number between 1 and ${tokens.length}`
            );
        }
        const deletedToken = tokens[number - 1];
        const removedFromChannelId = session[ctx.chat.id].selectedChannelId;
        const channel = await prisma.channel.findFirst({
            where: { channelId: removedFromChannelId },
        });
        await prisma.channel.update({
            where: {
                id: channel.id,
            },
            data: {
                buyBlackListedTokens: {
                    delete: {
                        id: deletedToken.id,
                    },
                },
            },
        });
        session[ctx.chat.id].setting = {};
        await reply(
            ctx,
            `token removed from buy ${
                channel.type === CHANNEL_BLACK_LIST_TYPE.WHITELIST
                    ? "white"
                    : "black"
            }list successfully`,
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const setMinimumEther = async (ctx, number) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.setMinimumEther
        ]; //{}
    try {
        const channelId = session[ctx.chat.id].selectedChannelId;
        const channel = await prisma.channel.findFirst({
            where: { channelId: channelId },
        });
        await prisma.channel.update({
            where: {
                id: channel.id,
            },
            data: {
                minimumEther: number || null,
            },
        });
        session[ctx.chat.id].setting = {};
        await reply(
            ctx,
            `minimum ether value has been ${number ? "set" : "unset"}`,
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
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
            return await reply(
                ctx,
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
        await reply(
            ctx,
            "wallet added to channel successfully",
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const addTokenToChannel = async (ctx, token) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.addBlackListToken
        ];
    try {
        const tokenData = await getTokenInfo(token);
        if (!tokenData) {
            return reply(ctx, "couldn't get token info");
        }
        const channel = await prisma.channel.findFirst({
            where: {
                channelId: session[ctx.chat.id].selectedChannelId,
            },
        });
        const updatedChannel = await prisma.channel.update({
            where: { id: channel.id },
            data: {
                blackListedTokens: {
                    create: {
                        contractId: token,
                        name: tokenData.symbol,
                    },
                },
            },
        });
        session[ctx.chat.id].setting = {};
        await reply(
            ctx,
            `token added to sell ${
                channel.type === CHANNEL_BLACK_LIST_TYPE.WHITELIST
                    ? "white"
                    : "black"
            }list successfully`,
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {number} number
 */
const addBuyTokenToChannel = async (ctx, token) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.channelSelected.addBuyBlackListToken
        ];
    try {
        const tokenData = await getTokenInfo(token);
        if (!tokenData) {
            return reply(ctx, "couldn't get token info");
        }
        const channel = await prisma.channel.findFirst({
            where: {
                channelId: session[ctx.chat.id].selectedChannelId,
            },
        });
        const updatedChannel = await prisma.channel.update({
            where: { id: channel.id },
            data: {
                buyBlackListedTokens: {
                    create: {
                        contractId: token,
                        name: tokenData.symbol,
                    },
                },
            },
        });
        session[ctx.chat.id].setting = {};
        await reply(
            ctx,
            `token added to buy ${
                channel.type === CHANNEL_BLACK_LIST_TYPE.WHITELIST
                    ? "white"
                    : "black"
            }list successfully`,
            markups.selectedChannel
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};

/**
 *
 * @param {import('telegraf').Context} ctx
 * @param {string} text
 */
const addTokenToFileBlackList = async (ctx, text) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.fileCompareOptions.addBlackListToken
        ];
    if (!ses.number) {
        ses.number = text.toLowerCase();
        session[ctx.chat.id].setting[
            displayStrings.fileCompareOptions.addBlackListToken
        ] = ses;
        return await reply(ctx, "please send wallet name tag");
    } else if (!ses.nameTag) {
        ses.nameTag = text;
        try {
            const account = ses.number;
            let nameTag = ses.nameTag;
            if (!(account[0] === "0" && account[1] === "x")) {
                reply(ctx, "please send a proper wallet that starts with 0x");
                return;
            }
            await reply(ctx, "... processing address");

            const prev = await prisma.blackListTokensForFiles.findFirst({
                where: { contractId: account },
            });
            if (prev) {
                reply(ctx, "token already exists");
                return;
            }
            // const data = await getLastTransaction(account);
            // if (!data?.hash) {
            //     return await reply(ctx,
            //         "couldn't get last transaction of wallet, please try again"
            //     );
            // }
            await prisma.blackListTokensForFiles.create({
                data: {
                    contractId: account,
                    name: nameTag,
                },
            });

            delete session[ctx.chat.id].settings;
            await reply(
                ctx,
                `token \n${nameTag}\nadded to blacklist successfully`,
                markups.fileCompareMarkup
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
const removeTokenFromFileBlacklist = async (ctx, number) => {
    let ses =
        session[ctx.chat.id].setting[
            displayStrings.fileCompareOptions.removeBlackListToken
        ];
    const tokens = ses.tokens;
    try {
        if (number > tokens.length || number < 1) {
            return await reply(
                ctx,
                `please send number between 1 and ${tokens.length}`
            );
        }
        const deletedToken = tokens[number - 1];
        await prisma.blackListTokensForFiles.delete({
            where: { id: deletedToken.id },
        });
        delete session[ctx.chat.id].setting;
        await reply(
            ctx,
            "token removed from blacklist successfully",
            markups.fileCompareMarkup
        );
    } catch (e) {
        console.log(e);
        return await reply(ctx, "something went wrong");
    }
};
