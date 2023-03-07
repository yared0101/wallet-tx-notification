const { default: axios } = require("axios");
const { displayStrings, session, markups, prisma } = require("../config");
const {
    formatSendWallets,
    formatSendChannels,
    formatSendTokens,
    formatSendMatchingTokens,
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
    bot.hears(displayStrings.fileCompare, async (ctx) => {
        try {
            session[ctx.chat.id] = {
                fileCompare: {
                    files: [],
                    addFile: false,
                },
            };
            await ctx.reply(
                `please press ${displayStrings.fileCompareOptions.addFile} to start adding files`,
                markups.fileCompareMarkup
            );
        } catch (e) {
            console.log(e);
            await ctx.reply("something went wrong");
        }
    });
    bot.hears(displayStrings.fileCompareOptions.addFile, async (ctx) => {
        try {
            session[ctx.chat.id] = {
                fileCompare: {
                    // files: ["BQACAgQAAxkBAAIrbmP893bHX5gAARML-VbADduoBaWZ2gAC1g8AAlmU4VOmX2ZF6uCqcS4E","BQACAgQAAxkBAAIrb2P893bnJNRPMnJDyC8RdA7c0uANAAIMDQACMdZwUxVvDJkNsCB1LgQ",],
                    files: [],
                    addFile: true,
                },
            };
            await ctx.reply(
                `please start sending the csv formatted files`,
                markups.fileCompareMarkup
            );
        } catch (e) {
            console.log(e);
            await ctx.reply("something went wrong");
        }
    });
    bot.hears(
        displayStrings.fileCompareOptions.addBlackListToken,
        async (ctx) => {
            if (!session[ctx.chat.id]?.fileCompare) {
                return await ctx.reply(
                    `Please press ${displayStrings.fileCompare} to start dealing with file blacklists`,
                    markups.homeMarkup
                );
            }
            try {
                session[ctx.chat.id].setting = {
                    [displayStrings.fileCompareOptions.addBlackListToken]: {},
                };
                await ctx.reply("please send token address");
            } catch (e) {}
        }
    );
    bot.hears(
        displayStrings.fileCompareOptions.listBlackListToken,
        async (ctx) => {
            try {
                if (!session[ctx.chat.id]?.fileCompare) {
                    return await ctx.reply(
                        `Please press ${displayStrings.fileCompare} to start dealing with file blacklists`,
                        markups.homeMarkup
                    );
                }
                await ctx.reply(
                    formatSendTokens(
                        await prisma.blackListTokensForFiles.findMany()
                    )
                );
            } catch (e) {
                console.log(e);
                await ctx.reply("something went wrong");
            }
        }
    );
    bot.hears(
        displayStrings.fileCompareOptions.removeBlackListToken,
        async (ctx) => {
            if (!session[ctx.chat.id]?.fileCompare) {
                return await ctx.reply(
                    `Please press ${displayStrings.fileCompare} to start dealing with file blacklists`,
                    markups.homeMarkup
                );
            }
            try {
                const tokens = await prisma.blackListTokensForFiles.findMany();
                if (!tokens.length) {
                    return await ctx.reply(
                        `no token found , please use \n${displayStrings.fileCompareOptions.addBlackListToken}\nto add token to blacklist`
                    );
                }
                session[ctx.chat.id].setting = {
                    [displayStrings.fileCompareOptions.removeBlackListToken]: {
                        tokens,
                    },
                };
                await ctx.reply(formatSendTokens(tokens));
                await ctx.reply("please send token number from the list");
            } catch (e) {}
        }
    );
    bot.hears(
        [
            displayStrings.fileCompareOptions.displaySellResults,
            displayStrings.fileCompareOptions.displayBuyResults,
            displayStrings.fileCompareOptions.displayBothResults,
        ],
        async (ctx) => {
            try {
                if (!session[ctx.chat.id]?.fileCompare) {
                    return await ctx.reply(
                        `Please press ${displayStrings.fileCompare} to start dealing with file blacklists`,
                        markups.homeMarkup
                    );
                }
                if (!session[ctx.chat.id].fileCompare.files.length) {
                    return await ctx.reply(
                        "No file has been added, please add files first"
                    );
                }
                if (session[ctx.chat.id].fileCompare.files.length < 2) {
                    return await ctx.reply("At least 2 files are necessary");
                }
                const files = session[ctx.chat.id].fileCompare.files;
                await ctx.reply("please wait, it may be a while ...");
                const fileUrls = await fileUrlsLoader(files, bot);
                const downloadedFiles = await getFiles(fileUrls);
                const blackListTokens =
                    await prisma.blackListTokensForFiles.findMany();
                //everything calculated with the whitelisting algorithm written in trials.js(dev file only not pushed on repo)
                let matchingTokens = [];
                if (
                    ctx.message.text ===
                    displayStrings.fileCompareOptions.displaySellResults
                ) {
                    matchingTokens = getMatchingSellTokensFromFiles(
                        downloadedFiles,
                        blackListTokens.map((elem) => elem.contractId)
                    );
                } else if (
                    ctx.message.text ===
                    displayStrings.fileCompareOptions.displayBuyResults
                ) {
                    matchingTokens = getMatchingBuyTokensFromFiles(
                        downloadedFiles,
                        blackListTokens.map((elem) => elem.contractId)
                    );
                } else {
                    matchingTokens = getMatchingBothTokensFromFiles(
                        downloadedFiles,
                        blackListTokens.map((elem) => elem.contractId)
                    );
                }
                const foundWallets = await prisma.account.findMany({
                    where: {
                        account: {
                            in: matchingTokens,
                            mode: "insensitive",
                        },
                    },
                });
                const matchedFinalText = formatSendMatchingTokens(
                    matchingTokens,
                    foundWallets
                );
                await ctx.reply(matchedFinalText, { parse_mode: "HTML" });
            } catch (e) {
                console.log(e);
                await ctx.reply("something went wrong");
            }
        }
    );
    bot.hears(displayStrings.fileCompareOptions.cleanFiles, async (ctx) => {
        try {
            if (!session[ctx.chat.id]?.fileCompare) {
                return await ctx.reply(
                    `Please press ${displayStrings.fileCompare} to start dealing with file blacklists`,
                    markups.homeMarkup
                );
            }
            if (!session[ctx.chat.id]?.fileCompare.files.length) {
                return await ctx.reply(
                    "No file has been added, please add files first"
                );
            }
            session[ctx.chat.id].fileCompare.files = [];
            await ctx.reply(
                `All files have been cleaned from memory, press ${displayStrings.fileCompareOptions.addFile} to start adding`
            );
        } catch (e) {
            console.log(e);
            await ctx.reply("something went wrong");
        }
    });
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

/**
 *
 * @param {string[]} files
 * @param {import("telegraf").Context} bot
 */
const fileUrlsLoader = async (files, bot) => {
    let fileUrls = [];
    for (let file of files) {
        const urlObj = await bot.telegram.getFileLink(file);
        fileUrls.push(urlObj.href);
    }
    return fileUrls;
};
/**
 *
 * @param {string[]} fileUrls
 */
const getFiles = async (fileUrls) => {
    let files = [];
    for (let fileUrl of fileUrls) {
        const file = await axios.get(fileUrl);
        files.push(file.data);
    }
    return files;
};

/**
 *
 * @param {string[]} files
 * @param {string[]} blackListTokens
 * @returns
 */
const getMatchingSellTokensFromFiles = (files, blackListTokens) => {
    //implementing a whitelist array which adds all the previous added tokens, and if token isn't in white list and white list exists it means
    //this means the last token per file is actually all we need
    let whitelist = [];
    for (let i in files) {
        const file = files[i];
        //split file into lines
        let lines = file.split("\n");
        //removes title line
        lines.shift();
        let tokensPerFile = [];
        //get token from each line and push inot tokens per line
        for (let line of lines) {
            //split with comma to find the token in its own value in the 4th index
            const token = line.split(",")[4]?.replace(/"/g, "");
            if (token) {
                //don't register blacklist items and already added items
                if (
                    !blackListTokens.includes(token) &&
                    !tokensPerFile.includes(token)
                ) {
                    if (i == 0) {
                        //pass here if it's first time around and 1st whitelist isn't constructed
                        tokensPerFile.push(token);
                    } else {
                        if (whitelist.includes(token)) {
                            tokensPerFile.push(token);
                        }
                    }
                }
            }
        }
        whitelist = tokensPerFile;
        //push all the files token into all tokens array of arrrays
    }
    return whitelist;
};

/**
 *
 * @param {string[]} files
 * @param {string[]} blackListTokens
 * @returns
 */
const getMatchingBuyTokensFromFiles = (files, blackListTokens) => {
    //implementing a whitelist array which adds all the previous added tokens, and if token isn't in white list and white list exists it means
    //this means the last token per file is actually all we need
    let whitelist = [];
    for (let i in files) {
        const file = files[i];
        //split file into lines
        let lines = file.split("\n");
        //removes title line
        lines.shift();
        let tokensPerFile = [];
        //get token from each line and push inot tokens per line
        for (let line of lines) {
            //split with comma to find the token in its own value in the 4th index
            const token = line.split(",")[5]?.replace(/"/g, "");
            if (token) {
                //don't register blacklist items and already added items
                if (
                    !blackListTokens.includes(token) &&
                    !tokensPerFile.includes(token)
                ) {
                    if (i == 0) {
                        //pass here if it's first time around and 1st whitelist isn't constructed
                        tokensPerFile.push(token);
                    } else {
                        if (whitelist.includes(token)) {
                            tokensPerFile.push(token);
                        }
                    }
                }
            }
        }
        whitelist = tokensPerFile;
        //push all the files token into all tokens array of arrrays
    }
    return whitelist;
};

/**
 *
 * @param {string[]} files
 * @param {string[]} blackListTokens
 * @returns
 */
const getMatchingBothTokensFromFiles = (files, blackListTokens) => {
    //implementing a whitelist array which adds all the previous added tokens, and if token isn't in white list and white list exists it means
    //this means the last token per file is actually all we need
    let whitelist = [];
    for (let i in files) {
        const file = files[i];
        //split file into lines
        let lines = file.split("\n");
        //removes title line
        lines.shift();
        let tokensPerFile = [];
        //get token from each line and push inot tokens per line
        for (let line of lines) {
            //split with comma to find the token in its own value in the 4th index
            const token = line.split(",")[4]?.replace(/"/g, "");
            if (token) {
                //don't register blacklist items and already added items
                if (
                    !blackListTokens.includes(token) &&
                    !tokensPerFile.includes(token)
                ) {
                    if (i == 0) {
                        //pass here if it's first time around and 1st whitelist isn't constructed
                        tokensPerFile.push(token);
                    } else {
                        if (whitelist.includes(token)) {
                            tokensPerFile.push(token);
                        }
                    }
                }
            }
            const token2 = line.split(",")[5]?.replace(/"/g, "");
            if (token2) {
                //don't register blacklist items and already added items
                if (
                    !blackListTokens.includes(token2) &&
                    !tokensPerFile.includes(token2)
                ) {
                    if (i == 0) {
                        //pass here if it's first time around and 1st whitelist isn't constructed
                        tokensPerFile.push(token2);
                    } else {
                        if (whitelist.includes(token2)) {
                            tokensPerFile.push(token2);
                        }
                    }
                }
            }
        }
        whitelist = tokensPerFile;
        //push all the files token into all tokens array of arrrays
    }
    return whitelist;
};
