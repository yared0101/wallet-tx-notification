const { displayStrings, buyTokens } = require("../config");

const formatSendWallets = (list) => {
    let sent = "";
    for (let i in list) {
        walletData = list[i];
        sent += `${Number(i) + 1} - ${walletData.nameTag} - ${
            walletData.account
        }\n\n`;
    }
    return sent || "No Wallets registered for listening";
};
/**
 * formats matched tokens from file to be sent to user
 * @param {string[]} list list of addresses
 * @param {import('@prisma/client').Account[]} matchingAccounts list of addresses
 * @returns
 */
const formatSendMatchingTokens = (list, matchingAccounts) => {
    if (!list.length) {
        return "No matching addresses found";
    }
    let sent = "Matching adresses found:\n";
    for (let i in list) {
        token = list[i];
        const matched = matchingAccounts.find(
            (elem) => elem.account.toLowerCase() === token
        );
        sent += `${Number(i) + 1} - ${
            matched ? matched.nameTag : `<code>${token}</code>`
        }\n`;
    }
    return sent || "No Wallets registered for listening";
};

const formatSendTokens = (list) => {
    let sent = "";
    for (let i in list) {
        token = list[i];
        sent += `${Number(i) + 1} - ${token.name} - ${token.contractId}\n\n`;
    }
    return sent || "No tokens added in list";
};
/**
 *
 * @param {import('@prisma/client').Channel[]} list
 * @returns
 */
const formatSendChannels = (list) => {
    let sent = "";
    for (let i in list) {
        const channel = list[i];
        sent += `${Number(i) + 1} - ${channel.name}\n\n`;
    }
    return (
        sent ||
        `No Channels added, Please use the button \n${displayStrings.addChannel}\nto add more`
    );
};

/**
 *
 * @param {import('@prisma/client').Channel} channel
 */
const formatSendDetailChannel = (channel) => {
    return `--    CHANNEL ${channel.name.toUpperCase()}

Name:  ${channel.name}
List Type: ${channel.type}
Minimum Ether:  ${channel.minimumEther || "Not Set"}
    `;
};

/**
 *
 * @param {string} value
 */
const hexaToDecimalPending = (value) => {
    return (parseInt(value || "0", 16) / 1e18).toFixed(3); //u dont need 16 actually
};

/**
 *
 * @param {string} value
 */
const toDecimalComplete = (value) => {
    return (parseInt(value || "0") / 1e18).toFixed(3);
};
/**
 * @param {{value:string, tokenDecimal:string}} val
 */
const realval = (val) =>
    (parseInt(val.value) / Math.pow(10, parseInt(val.tokenDecimal))).toFixed(0);
/**
 *
 * @param {{
 *  blockHash: string,
 *  blockNumber: string,
 *  from: string,
 *  gasPrice: string,
 *  maxFeePerGas: string,
 *  maxPriorityFeePerGas: string,
 *  hash: string,
 *  input: string,
 *  nonce: string,
 *  to: string,
 *  transactionIndex: string,
 *  value: string,
 *  type: string,
 *  accessList: Array<string>,
 *  v: string,
 *  r: string,
 *  s: string
 * }} txn
 * @param {import('@prisma/client').Account} wallet
 * @returns
 */
const formatSendPending = (txn, wallet, url) => {
    const isSwap = Boolean(txn.input);
    const isFromTransfer =
        txn.from.toLowerCase() === wallet.account.toLowerCase();
    const isSell = !Boolean(parseInt(txn.value));
    let sentMessage = `${
        isSwap
            ? "Swap for Wallet "
            : isFromTransfer
            ? "Outgoing Transfer from"
            : "Incoming Transfer to"
    } ${wallet.nameTag} (Pending):\n\n`;
    sentMessage += `value ${hexaToDecimalPending(txn.value)} Ether | ${
        isSwap ? (isSell ? "Sell 🔴" : "Buy 🟢") : "Transfer 🟡"
    }\n\n`;
    sentMessage += `${url}/tx/${txn.hash}`;

    return sentMessage;
};
/**
 *
 * @param {{
 *  blockNumber: string,
 *  timeStamp: string,
 *  hash: string,
 *  blockHash: string,
 *  transactionIndex: string,
 *  from: string,
 *  to: string,
 *  value: string,
 *  gas: string,
 *  gasPrice: string,
 *  isError: string,
 *  txreceipt_status: string,
 *  input: string,
 *  contractAddress: string,
 *  cumulativeGasUsed: string,
 *  gasUsed: string,
 *  confirmations: string,
 * }} txn
 * @param {import('@prisma/client').Account} wallet
 * @param {{
 *  blockNumber: string,
 *  timeStamp: string,
 *  hash: string,
 *  nonce: string,
 *  blockHash: string,
 *  from: string,
 *  contractAddress: string,
 *  to: string,
 *  value: string,
 *  tokenName: string,
 *  tokenSymbol: string,
 *  tokenDecimal: string,
 *  transactionIndex: string,
 *  gas: string,
 *  gasPrice: string,
 *  gasUsed: string,
 *  cumulativeGasUsed: string,
 *  input: string,
 *  confirmations: string,
 * }[]} tokenData
 * @returns
 */
const formatSendComplete = (
    txn,
    wallet,
    url,
    sellValue,
    tokenData,
    isApprove
) => {
    const isSwap = Boolean(txn.input);
    const isSell = !Boolean(parseInt(txn.value));
    const isFromTransfer =
        txn.from.toLowerCase() === wallet.account.toLowerCase();
    let sentMessage = `${
        isApprove
            ? "Approve for Wallet"
            : isSwap
            ? "Swap for Wallet "
            : isFromTransfer
            ? "Outgoing Transfer from"
            : "Incoming Transfer to"
    } ${wallet.nameTag} (Completed):\n\n`;
    if (tokenData?.length) {
        if (tokenData.length === 2) {
            if (
                buyTokens.find((elem) => elem === tokenData[0].contractAddress)
            ) {
                sentMessage += "Buy 🟢";
            } else {
                sentMessage += "Sell 🔴";
            }
            console.log(tokenData[0].contractAddress, buyTokens);
            sentMessage += ` ${realval(tokenData[0])} ${
                tokenData[0].tokenSymbol
            } for ${realval(tokenData[1])} ${tokenData[1].tokenSymbol}`;
        } else {
            sentMessage += `value ${toDecimalComplete(
                sellValue || txn.value
            )} Ether | ${
                isSwap ? (isSell ? "Sell 🔴" : "Buy 🟢") : "Transfer 🟡"
            }\n\n`;
            tokenData = tokenData[0];
            const etherVal = Number(toDecimalComplete(sellValue || txn.value));
            if (!etherVal) return false;
            if (isSell) {
                sentMessage += `Swap ${realval(tokenData)} ${
                    tokenData.tokenSymbol
                } for ${etherVal} Ether`;
            } else {
                sentMessage += `Swap ${etherVal} Ether for ${realval(
                    tokenData
                )} ${tokenData.tokenSymbol}`;
            }
        }
        sentMessage += "\n\n";
    } else {
        if (isApprove) {
            //don't do anything
        } else {
            sentMessage += `value ${toDecimalComplete(
                sellValue || txn.value
            )} Ether | ${
                isSwap ? (isSell ? "Sell 🔴" : "Buy 🟢") : "Transfer 🟡"
            }\n\n`;
        }
    }
    sentMessage += `${url}/tx/${txn.hash}`;

    return sentMessage;
};
/**
 *
 * @param {string} contractAddress all in small
 * @param {import("@prisma/client").BlackListContracts[]} tokens
 * @param {import("@prisma/client").PendingTransactions} pendingData
 */
const isBlackListed = (contractAddress, tokens, pendingData) => {
    console.log({ contractAddress, tokens });
    const addressesArray = tokens.map((elem) => elem.contractId.toLowerCase());
    const foundIndex = addressesArray.indexOf(contractAddress);
    if (foundIndex === -1) {
        return false;
    } else {
        // try {
        //     bot.telegram.sendMessage(
        //         process.env.USER_ID,
        //         "BlackListed Transaction",
        //         {
        //             reply_to_message_id: pendingData.telegramSentMessageId,
        //             allow_sending_without_reply: true,
        //             disable_notification: true,
        //         }
        //     );
        // } catch (e) {}
        return true;
    }
};
module.exports = {
    formatSendTokens,
    formatSendWallets,
    formatSendComplete,
    formatSendPending,
    formatSendChannels,
    isBlackListed,
    formatSendDetailChannel,
    toDecimalComplete,
    formatSendMatchingTokens,
};
