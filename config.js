const { PrismaClient, CHANNEL_BLACK_LIST_TYPE } = require("@prisma/client");
const prisma = new PrismaClient();
const { Telegraf } = require("telegraf");
const bot = new Telegraf(process.env.BOT_TOKEN);

const winston = require("winston");
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");

// Create a Logtail client
const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);
const { combine, timestamp, json } = winston.format;

// var path = require("path");
// var scriptName = path.basename(__filename);
// console.log(scriptName);
// console.log("abebe");
// Create a Winston logger - passing in the Logtail transport
const winstonTransport =
    process.env.NODE_ENV === "development"
        ? new winston.transports.Console()
        : new LogtailTransport(logtail);
const logger = winston.createLogger({
    transports: [winstonTransport],
    // transports: new winston.transports.Console(),
    level: process.env.LOG_LEVEL || "info",
    format: combine(timestamp(), json()),
});
// const { Composer } = require("micro-bot");
// const bot = new Composer();
// bot.init = async (mBot) => {
//     bot.telegram = mBot.telegram;
// };

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
        addBlackListToken: "Add Sell token to black/white list",
        viewBlackListToken: "View Sell token black/white list",
        removeBlackListToken: "Remove Sell token black/white list",
        addBuyBlackListToken: "Add Buy token black/white list",
        viewBuyBlackListToken: "View Buy token black/white list",
        removeBuyBlackListToken: "Remove Buy token black/white list",
    },
    channelConfigs: {
        sendPending: (status) => beauty(`Send Pending`, status),
        sendComplete: (status) => beauty(`Send Complete`, status),
        sendSellTx: (status) => beauty(`Send Sell Tx`, status),
        sendBuyTx: (status) => beauty(`Send Buy Tx`, status),
        sendApprove: (status) => beauty(`Send Approve`, status),
        sendIncoming: (status) => beauty(`Send Incoming Tfers`, status),
        sendOutgoing: (status) => beauty(`Send Outgoing Tfers`, status),
        channelType: (type) =>
            `Channel type -  ${
                type === CHANNEL_BLACK_LIST_TYPE.BLACKLIST
                    ? "BLACKLIST ⚫"
                    : "WHITELIST ⚪"
            }`,
    },
    home: "Home",
    fileCompare: "Matching Addresses",
    priorityTrack: "Priority Transactions",
    priorityTrackNewSearch: "New Search",
    fileCompareOptions: {
        addFile: "Add File",
        displaySellResults: "Find Sell Addresses",
        displayBuyResults: "Find Buy Addresses",
        displayBothResults: "Find All Addresses",
        cleanFiles: "Remove All Uploaded",
        addBlackListToken: "Add Blacklist Address",
        removeBlackListToken: "Remove Blacklist Address",
        listBlackListToken: "List Blacklist Addresses",
    },
    addressFind: "Find Address",
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
                [
                    { text: displayStrings.fileCompare },
                    { text: displayStrings.priorityTrack },
                    { text: displayStrings.addressFind },
                ],
            ],
            resize_keyboard: true,
        },
    },
    homeOptionMarkup: {
        reply_markup: {
            keyboard: [[{ text: displayStrings.home }]],
            resize_keyboard: true,
        },
    },
    selectChannelMarkup: (channels) => {
        const spliceNum = channels.length >= 9 ? 3 : 2;
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
            counter += thisPushed.length - 1;
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
                        text: displayStrings.channelSelected.addBlackListToken,
                    },
                    {
                        text: displayStrings.channelSelected
                            .removeBlackListToken,
                    },
                    {
                        text: displayStrings.channelSelected.viewBlackListToken,
                    },
                ],
                [
                    {
                        text: displayStrings.channelSelected
                            .addBuyBlackListToken,
                    },
                    {
                        text: displayStrings.channelSelected
                            .removeBuyBlackListToken,
                    },
                    {
                        text: displayStrings.channelSelected
                            .viewBuyBlackListToken,
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
     * @param {{sendPending:boolean, sendComplete:boolean, sendBuyTx:boolean, sendSellTx:boolean, incomingTransfer:boolean, outGoingTransfer:boolean}} currentValues
     * @returns
     */
    channelSettingsInline: ({
        sendPending,
        sendComplete,
        sendBuyTx,
        sendSellTx,
        sendApprove,
        incomingTransfer,
        outGoingTransfer,
        type,
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
                    {
                        text: displayStrings.channelConfigs.sendApprove(
                            sendApprove
                        ),
                        callback_data: "config_APPROVE",
                    },
                ],
                [
                    {
                        text: displayStrings.channelConfigs.sendIncoming(
                            incomingTransfer
                        ),
                        callback_data: "config_INCOMING",
                    },
                    {
                        text: displayStrings.channelConfigs.sendOutgoing(
                            outGoingTransfer
                        ),
                        callback_data: "config_OUTGOING",
                    },
                ],
                [
                    {
                        text: displayStrings.channelConfigs.channelType(type),
                        callback_data: "config_TYPE",
                    },
                ],
            ],
            resize_keyboard: true,
        },
    }),
    fileCompareMarkup: {
        reply_markup: {
            resize_keyboard: true,
            keyboard: [
                [
                    {
                        text: displayStrings.fileCompareOptions.addFile,
                    },
                    {
                        text: displayStrings.fileCompareOptions.cleanFiles,
                    },
                ],
                [
                    {
                        text: displayStrings.fileCompareOptions
                            .displaySellResults,
                    },
                    {
                        text: displayStrings.fileCompareOptions
                            .displayBuyResults,
                    },
                    {
                        text: displayStrings.fileCompareOptions
                            .displayBothResults,
                    },
                ],
                [
                    {
                        text: displayStrings.fileCompareOptions
                            .addBlackListToken,
                    },
                    {
                        text: displayStrings.fileCompareOptions
                            .removeBlackListToken,
                    },
                ],
                [
                    {
                        text: displayStrings.fileCompareOptions
                            .listBlackListToken,
                    },
                    {
                        text: displayStrings.home,
                    },
                ],
            ],
        },
    },
    /**
     *
     * @param {import("@prisma/client").ContractAddressSettings[]} histories
     */
    prioritySearchHistory: (histories = []) => {
        return {
            reply_markup: {
                resize_keyboard: true,
                inline_keyboard: histories.map((elem) => [
                    {
                        text: `${elem.contractAddress.substring(0, 4)}..., ${
                            elem.days
                        } days, ${elem.minPriorityFee} - ${
                            elem.maxPriorityFee
                        }`,
                        callback_data: `PRIORITY_${elem.id}`,
                    },
                ]),
            },
        };
    },
    prioritySearchDefault: () => {
        const defaultReply = [
            {
                text: displayStrings.priorityTrackNewSearch,
            },
            {
                text: displayStrings.home,
            },
        ];
        return {
            reply_markup: {
                resize_keyboard: true,
                keyboard: [defaultReply],
            },
        };
    },
    /**
     *
     * @param {{address:string, balance: string}[]} addressList list of addresses and their balance
     * @param {number} currentIndex index of the first in the list currently displayed, index starts from 0
     * @returns
     */
    addressFindPrevNext: (addressList, currentIndex, pageSize = 10) => {
        let reply_markup = {};
        if (
            addressList.length <= pageSize + currentIndex &&
            currentIndex == 0
        ) {
            reply_markup = {};
        } else if (
            addressList.length <= pageSize + currentIndex &&
            currentIndex > 0
        ) {
            reply_markup = {
                resize_keyboard: true,
                inline_keyboard: [
                    [
                        {
                            text: `prev`,
                            callback_data: `prev_addresses`,
                        },
                    ],
                ],
            };
        } else if (
            addressList.length > pageSize + currentIndex &&
            currentIndex == 0
        ) {
            reply_markup = {
                resize_keyboard: true,
                inline_keyboard: [
                    [
                        {
                            text: `next`,
                            callback_data: `next_addresses`,
                        },
                    ],
                ],
            };
        } else {
            reply_markup = {
                resize_keyboard: true,
                inline_keyboard: [
                    [
                        {
                            text: `prev`,
                            callback_data: `prev_addresses`,
                        },
                        {
                            text: `next`,
                            callback_data: `next_addresses`,
                        },
                    ],
                ],
            };
        }
        return {
            reply_markup,
            parse_mode: "HTML",
        };
    },
};

const session = {};

const MAX_MESSAGE_LENGTH = 4000;
const minTime = 2;
const defaultTime = 10;
// const url = process.env.GOERLI_NET_URL;
// const baseUrl = process.env.GOERLI_BASE_NET_URL;
// const address = "0x628254F7513e02865AD6cD4A407dea5B5Da55012";
const url = process.env.MAIN_NET_URL;
const baseUrl = process.env.MAIN_BASE_NET_URL;

const buyTokens = [
    "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0x6b175474e89094c44da98b954eedeac495271d0f",
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
];
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
    buyTokens,
    logger,
    MAX_MESSAGE_LENGTH,
};
