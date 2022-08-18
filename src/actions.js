const { session, prisma, markups } = require("../config");
const { formatSendDetailChannel } = require("../utils");

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
            await ctx.reply(
                formatSendDetailChannel(channel),
                markups.selectedChannel
            );
        } catch (e) {
            console.log(e);
            await ctx.reply("something went wrong");
        } finally {
            ctx.answerCbQuery();
        }
    });
    bot.action(/config_.*/, async (ctx) => {
        try {
            const toggle = ctx.match[0].split("_")[1];
            const id = session[ctx.chat.id]?.selectedChannelId;
            if (!id) {
                await ctx.reply(
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
            await ctx.reply("something went wrong");
        } finally {
            ctx.answerCbQuery();
        }
    });
};
