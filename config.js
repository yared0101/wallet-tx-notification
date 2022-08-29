const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// const { Telegraf } = require("telegraf");
// const bot = new Telegraf(process.env.BOT_TOKEN);

const { Composer } = require("micro-bot");
const bot = new Composer();
bot.init = async (mBot) => {
    bot.telegram = mBot.telegram;
};

const beauty = (value, status) =>
    `${value}${status === true ? "🟢" : status === false ? "🔴" : ""}`;
const displayStrings = {
    addChannel: "Add Channel",
    removeChannel: "Remove Channel",
    listChannels: "Channel List",
    listWallets: "Wallet List",
    selectChannel: "Select Channel",
    addWallet: "Add Wallet",
    removeWallet: "Remove Wallet",
    channelSelected: {
        addWalletToChannel: "Add Wallet to Channel",
        removeWalletFromChannel: "Remove Wallet from Channel",
        listWalletsInChannel: "List Wallets",
        channelSettings: "Channel Settings",
        editChannel: "Edit Channel",
        setMinimumEther: "Set Minimum Ether",
    },
    channelConfigs: {
        sendPending: (status) => beauty(`Send Pending`, status),
        sendComplete: (status) => beauty(`Send Complete`, status),
        sendSellTx: (status) => beauty(`Send Sell Txns`, status),
        sendBuyTx: (status) => beauty(`Send Buy Txns`, status),
    },
    home: "Home",
};
const markups = {
    homeMarkup: {
        reply_markup: {
            keyboard: [
                [
                    { text: displayStrings.addChannel },
                    { text: displayStrings.addWallet },
                ],
                [{ text: displayStrings.listWallets }],
                [
                    { text: displayStrings.listChannels },
                    { text: displayStrings.selectChannel },
                ],
                [
                    { text: displayStrings.removeChannel },
                    { text: displayStrings.removeWallet },
                ],
            ],
            resize_keyboard: true,
        },
    },
    selectChannelMarkup: (channels) => {
        const spliceNum = channels.length > 9 ? 3 : 2;
        let inlineKeyboard = [];
        let counter = 0;
        for (; channels.length; ) {
            counter += 1;
            let thisPushed = channels.splice(0, spliceNum);
            inlineKeyboard.push(
                thisPushed.map((elem, index) => ({
                    text: counter + index,
                    callback_data: `selectChannel_${elem.channelId}`,
                }))
            );
        }
        return {
            reply_markup: {
                // keyboard: [[{ text: displayStrings.home }]],
                inline_keyboard: inlineKeyboard,
                resize_keyboard: true,
            },
        };
    },
    selectedChannel: {
        reply_markup: {
            resize_keyboard: true,
            keyboard: [
                [
                    {
                        text: displayStrings.channelSelected.channelSettings,
                    },
                    {
                        text: displayStrings.channelSelected.setMinimumEther,
                    },
                ],
                [
                    {
                        text: displayStrings.channelSelected
                            .listWalletsInChannel,
                    },
                ],
                [
                    {
                        text: displayStrings.channelSelected.addWalletToChannel,
                    },
                    {
                        text: displayStrings.channelSelected
                            .removeWalletFromChannel,
                    },
                ],
                [
                    {
                        text: displayStrings.home,
                    },
                ],
            ],
        },
    },
    /**
     *
     * @param {{sendPending:boolean, sendComplete:boolean, sendBuyTx:boolean, sendSellTx:boolean}} currentValues
     * @returns
     */
    channelSettingsInline: ({
        sendPending,
        sendComplete,
        sendBuyTx,
        sendSellTx,
    }) => ({
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: displayStrings.channelConfigs.sendPending(
                            sendPending
                        ),
                        callback_data: "config_PENDING",
                    },
                    {
                        text: displayStrings.channelConfigs.sendComplete(
                            sendComplete
                        ),
                        callback_data: "config_COMPLETE",
                    },
                ],
                [
                    {
                        text: displayStrings.channelConfigs.sendBuyTx(
                            sendBuyTx
                        ),
                        callback_data: "config_BUY",
                    },
                    {
                        text: displayStrings.channelConfigs.sendSellTx(
                            sendSellTx
                        ),
                        callback_data: "config_SELL",
                    },
                ],
            ],
            resize_keyboard: true,
        },
    }),
};

const session = {};

const minTime = 2;
const defaultTime = 5;
// const url = process.env.GOERLI_NET_URL;
// const baseUrl = process.env.GOERLI_BASE_NET_URL;
// const address = "0x628254F7513e02865AD6cD4A407dea5B5Da55012";
const url = process.env.MAIN_NET_URL;
const baseUrl = process.env.MAIN_BASE_NET_URL;

module.exports = {
    displayStrings,
    markups,
    session,
    minTime,
    defaultTime,
    prisma,
    bot,
    url,
    baseUrl,
};
