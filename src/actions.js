const { CHANNEL_BLACK_LIST_TYPE } = require("@prisma/client");
const { session, prisma, markups } = require("../config");
const {
    formatSendDetailChannel,
    reply,
    formatSendCAFilteredTxs,
} = require("../utils");
const {
    getTransactionsFromLastDayByContractAddress,
} = require("../utils/cryptoFunctions");
/**
 *
 * @param {import("telegraf").Telegraf} bot
 */
module.exports = (bot) => {
    bot.action(/selectChannel_.*/, async (ctx) => {
        try {
            const id = ctx.match[0].split("_")[1];
            session[ctx.chat.id] = {
                selectedChannelId: id,
            };
            const channel = await prisma.channel.findFirst({
                where: {
                    channelId: id,
                },
            });
            await reply(
                ctx,
                formatSendDetailChannel(channel),
                markups.selectedChannel
            );
        } catch (e) {
            console.log(e);
            await reply(ctx, "something went wrong");
        } finally {
            try {
                await ctx.answerCbQuery();
            } catch {}
        }
    });
    bot.action(/PRIORITY_.*/, async (ctx) => {
        try {
            const id = ctx.match[0].split("_")[1];
            await ctx.reply("Searching ...");
            const filter = await prisma.contractAddressSettings.findUnique({
                where: { id: Number(id) },
            });
            if (!filter) {
                return await ctx.reply(
                    "couldn't find the selected filter, try adding a new one"
                );
            }
            const priorityFeeTransactions =
                await getTransactionsFromLastDayByContractAddress(filter);
            const sentMessage = formatSendCAFilteredTxs(
                priorityFeeTransactions
            );
            return await ctx.reply(sentMessage, {
                disable_web_page_preview: true,
            });
        } catch (e) {
            console.log(e);
            await reply(ctx, "something went wrong");
        } finally {
            try {
                await ctx.answerCbQuery();
            } catch {}
        }
    });
    bot.action(/config_.*/, async (ctx) => {
        try {
            const toggle = ctx.match[0].split("_")[1];
            const id = session[ctx.chat.id]?.selectedChannelId;
            if (!id) {
                await reply(
                    ctx,
                    "please select channel first",
                    markups.homeMarkup
                );
                return await ctx.answerCbQuery();
            }
            const channel = await prisma.channel.findFirst({
                where: {
                    channelId: id,
                },
            });
            let updated = {};
            if (toggle === "PENDING") {
                updated = { sendPending: !channel.sendPending };
            }
            if (toggle === "COMPLETE") {
                updated = { sendComplete: !channel.sendComplete };
            }
            if (toggle === "BUY") {
                updated = { sendBuyTx: !channel.sendBuyTx };
            }
            if (toggle === "SELL") {
                updated = { sendSellTx: !channel.sendSellTx };
            }
            if (toggle === "APPROVE") {
                updated = { sendApprove: !channel.sendApprove };
            }
            if (toggle === "INCOMING") {
                updated = { incomingTransfer: !channel.incomingTransfer };
            }
            if (toggle === "OUTGOING") {
                updated = { outGoingTransfer: !channel.outGoingTransfer };
            }
            if (toggle === "TYPE") {
                updated = {
                    type:
                        channel.type === CHANNEL_BLACK_LIST_TYPE.BLACKLIST
                            ? CHANNEL_BLACK_LIST_TYPE.WHITELIST
                            : CHANNEL_BLACK_LIST_TYPE.BLACKLIST,
                };
            }
            const updatedChannel = await prisma.channel.update({
                where: { id: channel.id },
                data: updated,
            });
            await bot.telegram.editMessageReplyMarkup(
                ctx.chat.id,
                ctx.update.callback_query.message.message_id,
                "",
                markups.channelSettingsInline(updatedChannel).reply_markup
            );
            return await ctx.answerCbQuery();
        } catch (e) {
            console.log(e);
            await reply(ctx, "something went wrong");
        } finally {
            try {
                await ctx.answerCbQuery();
            } catch {}
        }
    });
};
