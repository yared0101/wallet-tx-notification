const { prisma, url } = require("../config");
const { default: axios } = require("axios");
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(process.env.ALCHEMY_WEBSOCKET);
// this variable is in memory as long as the server is running, which means we can store subscription object here
// and then unsubscribe when new addresses are added, to subscribe to the new addresses too!
// if server not running it means socket connection is lost so that's good enough
var subscription = [];
const apiKey = process.env.API_KEY;
/**
 * sends in last or given transaction data from given wallet address
 * @param {string} address wallet address
 * @param {string} transactionHash if exists, sends this transaction data instead of the last txn
 * @returns
 */
const getLastTransaction = async (address, transactionHash) => {
    if (!address) {
        return undefined;
    }
    try {
        const data = await axios.get(
            `${url}/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=0&sort=desc&apikey=${apiKey}`
        );
        if (transactionHash) {
            const lastTransaction = data.data.result.find(
                (elem) => elem.hash.toLowerCase() === transactionHash
            );
            return lastTransaction;
        } else {
            const lastTransaction = data.data.result[0];
            return lastTransaction;
        }
    } catch (e) {
        console.log(e.message);
        return undefined;
    }
};
/**
 *
 * @param {string} address
 * @param {string} hash
 * @returns
 */
const erc20TokenTransferEvents = async (address, hash) => {
    try {
        const data = await axios.get(
            `${url}/api?module=account&action=tokentx&address=${address}&page=1&offset=0&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
        );
        const transferredToken = data.data.result.filter(
            (elem) => elem.hash.toLowerCase() === hash.toLowerCase()
        );
        return [
            transferredToken.find(
                (elem) => elem.from.toLowerCase() === address.toLowerCase()
            ),
            transferredToken.find(
                (elem) => elem.to.toLowerCase() === address.toLowerCase()
            ),
        ].filter((elem) => elem);
    } catch (e) {
        console.log(e);
        return undefined;
    }
};
/**
 *
 * @param {string} transaction
 * @param {string} targetAcc
 * @returns
 */
const getInternalTransaction = async (transaction, targetAcc) => {
    // return undefined;
    try {
        const data = await axios.get(
            `${url}/api?module=account&action=txlistinternal&txhash=${transaction}&apikey=${apiKey}`
        );
        let returnable = data.data.result.find(
            (elem) => elem.to.toLowerCase() === targetAcc.toLowerCase()
        );
        return returnable;
    } catch (e) {
        console.log("internal out", e);
        return undefined;
    }
};
const subscribe = async (processPending) => {
    try {
        await subscription?.[0]?.unsubscribe();
        await subscription?.[1]?.unsubscribe();
        const wallets = await prisma.account.findMany();
        if (wallets.length) {
            subscription[0] = web3.eth
                .subscribe("alchemy_pendingTransactions", {
                    fromAddress: wallets.map((elem) => elem.account),
                    hashesOnly: false,
                })
                .on("data", (data) => {
                    processPending(data);
                });
            subscription[1] = web3.eth
                .subscribe("alchemy_pendingTransactions", {
                    toAddress: wallets.map((elem) => elem.account),
                    hashesOnly: false,
                })
                .on("data", (data) => {
                    processPending(data);
                });
            console.log("in", "subscription");
        } else {
            console.log("out", wallets);
        }
    } catch (e) {
        console.log("subscribe", e);
    }
};
const getTokenInfo = async (contractAddress) => {
    // const contractAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    try {
        const metadata = await web3.alchemy.getTokenMetadata(contractAddress);
        return metadata;
    } catch (e) {
        console.log("internal out", e);
        return undefined;
    }
};
module.exports = {
    erc20TokenTransferEvents,
    getInternalTransaction,
    getLastTransaction,
    subscribe,
    getTokenInfo,
};
