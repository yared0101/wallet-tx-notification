require("dotenv").config();
const { defaultTime, bot, prisma } = require("./config");
const { intervalFunction, processPending } = require("./services");
const { subscribe } = require("./utils/cryptoFunctions");
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
process.env.NODE_ENV === "development"
    ? bot.launch()
    : bot.launch({
          webhook: {
              domain: process.env.BOT_DOMAIN,
              port: 8080,
          },
      });
module.exports = bot;
console.log("started");
