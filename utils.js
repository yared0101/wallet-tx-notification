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
const formatSendTokens = (list) => {
    let sent = "";
    for (let i in list) {
        tokenData = list[i];
        sent += `${Number(i) + 1} - ${tokenData.contractId}\n\n`;
    }
    return sent || "No Tokens in blacklist";
};

/**
 *
 * @param {string} value
 */
const hexaToDecimalPening = (value) => {
    return parseInt(value || "0", 16) / 1e18; //u dont need 16 actually
};

/**
 *
 * @param {string} value
 */
const toDecimalComplete = (value) => {
    return parseInt(value || "0") / 1e18;
};

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
    const isSell = !Boolean(parseInt(txn.value));
    let sentMessage = `New Transaction for Wallet ${wallet.nameTag}:\n\n`;
    sentMessage += `value ${hexaToDecimalPening(txn.value)} Ether | ${
        isSell ? "Sell 🔴" : "Buy 🟢"
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
 * @returns
 */
const formatSendComplete = (txn, wallet, url) => {
    const isSell = !Boolean(parseInt(txn.value));
    let sentMessage = `Transaction confirmed for Wallet ${wallet.nameTag}:\n\n`;
    sentMessage += `value ${toDecimalComplete(txn.value)} Ether | ${
        isSell ? "Sell 🔴" : "Buy 🟢"
    }\n\n`;
    sentMessage += `${url}/tx/${txn.hash}`;

    return sentMessage;
};

module.exports = {
    formatSendTokens,
    formatSendWallets,
    formatSendComplete,
    formatSendPending,
};
