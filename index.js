require("dotenv").config();
const express = require("express");
const { defaultTime, bot, prisma } = require("./config");
const { intervalFunction, processPending } = require("./services");
const { subscribe } = require("./utils/cryptoFunctions");
const app = express();
app.use(await bot.createWebhook({ domain: process.env.BOT_DOMAIN }));

const main = async () => {
    const configData = await prisma.time.findFirst();
    const setTime = configData?.totalTime;
    await subscribe(processPending);
    setInterval(intervalFunction, (setTime || defaultTime) * 1000);
};
main();
require("./src/commands")(bot);
require("./src/actions")(bot);
require("./src/hears")(bot);
require("./src/raw_inputs")(bot);

app.listen(8080, () => console.log("Listening on port", 8080));
// module.exports = bot;
console.log("started");
