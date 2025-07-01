const { prisma, url } = require("../config");
const { default: axios } = require("axios");
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const web3 = createAlchemyWeb3(process.env.ALCHEMY_HTTPS);
const web3Wss = createAlchemyWeb3(process.env.ALCHEMY_WEBSOCKET);
const { BigQuery } = require("@google-cloud/bigquery");
const path = require("path");
const keyFilename = path.join(__dirname, "./big_query_credentials.json");
const bigquery = new BigQuery({ keyFilename });

const { Alchemy, Network, AlchemySubscription } = require("alchemy-sdk");
const settings = {
    apiKey: process.env.ALCHEMY_APIKEY, // Replace with your Alchemy API Key
    network: Network.ETH_MAINNET, // Replace with your network
};
const alchemy = new Alchemy(settings);

// this variable is in memory as long as the server is running, which means we can store subscription object here
// and then unsubscribe when new addresses are added, to subscribe to the new addresses too!
// if server not running it means socket connection is lost so that's good enough
var subscription = [];
var completeSubscription = [];
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
const erc20TokenTransferEvents = async (account, hash) => {
    try {
        // const data = await axios.get(
        //     `${url}/api?module=account&action=tokentx&address=${address}&page=1&offset=0&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
        // );
        // const transferredToken = data.data.result.filter(
        //     (elem) => elem.hash.toLowerCase() === hash.toLowerCase()
        // );
        // return [
        //     transferredToken.find(
        //         (elem) => elem.from.toLowerCase() === address.toLowerCase()
        //     ),
        //     transferredToken.find(
        //         (elem) => elem.to.toLowerCase() === address.toLowerCase()
        //     ),
        // ].filter((elem) => elem);
        // what's needed from old
        // hash, from, contractAddress, to, value, tokenSymbol, tokenDecimal
        /// we have
        /**
         * {
    blockNum: '0x1593e47',
    uniqueId: '0x75e8696ba854fb497299c8a73986c0a4759ce0b47bbf06250a1744de0bc1d61b:log:284',
    hash: '0x75e8696ba854fb497299c8a73986c0a4759ce0b47bbf06250a1744de0bc1d61b',
    from: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
    to: '0x76f60abb5a4cfa34fe97aff07795147983ef71bb',
    value: 33175.47415189512,
    erc721TokenId: null,
    erc1155Metadata: null,
    tokenId: null,
    asset: 'APES',
    category: 'erc20',
    rawContract: {
      value: '0x07067230d1f40e429dae',
      address: '0x09675e24ca1eb06023451ac8088eca1040f47585',
      decimal: '0x12'
    }
  }
    instead
         */
        const response = await alchemy.core.getAssetTransfers({
            fromBlock: "0x0",
            toBlock: "latest",
            excludeZeroValue: true,
            category: ["erc20"],
            // fromAddress: account,
            toAddress: account,
        });

        // Filtering by hash within the response is more robust as getAssetTransfers doesn't
        // directly filter by transaction hash in the request itself.
        const erc20Transfers1 = response.transfers.filter(
            (transfer) => transfer.hash.toLowerCase() === hash.toLowerCase()
        );
        const response2 = await alchemy.core.getAssetTransfers({
            fromBlock: "0x0",
            toBlock: "latest",
            excludeZeroValue: true,
            category: ["erc20"],
            fromAddress: account,
            // toAddress: account,
        });
        const erc20Transfers2 = response2.transfers.filter(
            (transfer) => transfer.hash.toLowerCase() === hash.toLowerCase()
        );
        const erc20Transfers = [...erc20Transfers1, ...erc20Transfers2];
        // if the transfers have the same tokenSymbol, or .asset keep the large one
        let newErc20Transfers = [];
        const seenTokens = new Set();
        for (const transfer of erc20Transfers) {
            if (!seenTokens.has(transfer.asset)) {
                seenTokens.add(transfer.asset);
                newErc20Transfers.push(transfer);
            } else {
                const existingTransfer = newErc20Transfers.find(
                    (t) => t.asset === transfer.asset
                );
                if (
                    existingTransfer &&
                    existingTransfer.value < transfer.value
                ) {
                    newErc20Transfers = newErc20Transfers.filter(
                        (t) => t.asset !== transfer.asset
                    );
                    newErc20Transfers.push(transfer);
                }
            }
        }
        // if value.to= account, then sort it below
        newErc20Transfers.sort((a, b) => {
            if (a.to.toLowerCase() === account.toLowerCase()) {
                return 1; // a goes to the end
            } else if (b.to.toLowerCase() === account.toLowerCase()) {
                return -1; // b goes to the end
            } else {
                return 0; // keep original order
            }
        });
        if (newErc20Transfers.length) {
            return newErc20Transfers.map((transfer) => ({
                ...transfer,
                hash: transfer.hash,
                from: transfer.from,
                contractAddress: transfer.rawContract?.address,
                to: transfer.to,
                value: transfer.value,
                tokenSymbol: transfer.asset,
                tokenDecimal: 0,
            }));
        } else {
            return [];
        }
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
        // const data = await axios.get(
        //     `${url}/api?module=account&action=txlistinternal&txhash=${transaction}&apikey=${apiKey}`
        // );
        // let returnable = data.data.result.find(
        //     (elem) => elem.to.toLowerCase() === targetAcc.toLowerCase()
        // );
        // return returnable;
        const response = await alchemy.core.getAssetTransfers({
            fromBlock: "0x0",
            toBlock: "latest",
            category: ["internal"],
            excludeZeroValue: true,
            toAddress: targetAcc,
        });
        // filter by transaction
        let internalTransfer = response.transfers.find(
            (transfer) => transfer.hash === transaction
        );
        if (internalTransfer) {
            // multiply value by 1e18 to get the correct value
            internalTransfer.value = internalTransfer.value * 1e18;
        }
        return internalTransfer;
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
            subscription[0] = web3Wss.eth
                .subscribe("alchemy_pendingTransactions", {
                    fromAddress: wallets.map((elem) => elem.account),
                    hashesOnly: false,
                })
                .on("data", (data) => {
                    processPending(data);
                });
            subscription[1] = web3Wss.eth
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

const subscribeComplete = async (processCompletedFromSubscription) => {
    try {
        // await completeSubscription?.[0]?.unsubscribe();
        // await completeSubscription?.[1]?.unsubscribe();
        const wallets = await prisma.account.findMany();
        if (wallets.length) {
            // completeSubscription[0] = web3.eth
            //     .subscribe("alchemy_minedTransactions", {
            //         fromAddress: wallets.map((elem) => elem.account),
            //         hashesOnly: false,
            //         includeRemoved: false,
            //     })
            //     .on("data", (data) => {
            //         processCompletedFromSubscription(data, "from");
            //     });
            completeSubscription[0] = alchemy.ws.on(
                {
                    method: AlchemySubscription.MINED_TRANSACTIONS,
                    addresses: wallets.map((elem) => ({ from: elem.account })),
                    includeRemoved: false,
                    hashesOnly: false,
                },
                (tx) => processCompletedFromSubscription(tx, "from")
            );
            completeSubscription[1] = alchemy.ws.on(
                {
                    method: AlchemySubscription.MINED_TRANSACTIONS,
                    addresses: wallets.map((elem) => ({ to: elem.account })),
                    includeRemoved: false,
                    hashesOnly: false,
                },
                (tx) => processCompletedFromSubscription(tx, "to")
            );
            console.log("in", "subscription");
        } else {
            console.log("out", wallets);
        }
    } catch (e) {
        console.log("subscribe completed ", e);
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

const alchemyTransaction = async (txHash) => {
    const transaction = await web3.eth.getTransaction(txHash);
    const priorityFee = parseInt(transaction.maxPriorityFeePerGas || "") / 1e9;
    const timedata = await web3.eth.getBlock(transaction.blockNumber);
    const formattedPriorityFee = `${priorityFee} Gwei`;
    return {
        ...transaction,
        formattedPriorityFee: formattedPriorityFee,
        priorityFee,
        formattedTimestamp: new Date(
            Number(timedata.timestamp) * 1000
        ).toUTCString(),
        timestamp: timedata.timestamp,
    };
};

/**
 *
 * @param {import("@prisma/client").ContractAddressSettings} filter
 * @returns
 */
const getTransactionsFromLastDayByContractAddress = async (
    filter,
    callback,
    errorCallback,
    updatePercentage
) => {
    try {
        const { contractAddress, days, minPriorityFee, maxPriorityFee } =
            filter;
        const currentBlockNumber = await web3.eth.getBlockNumber();
        const blockNumberFor24HoursAgo = currentBlockNumber - days * 250;
        const transactions = await web3.eth.getPastLogs({
            address: contractAddress,
            fromBlock: blockNumberFor24HoursAgo,
            toBlock: currentBlockNumber,
        });
        const uniqueTransactionHashes = [
            ...new Set(transactions.map((obj) => obj.transactionHash)),
        ];
        let priorityFeeTransactions = [];
        for (let i in uniqueTransactionHashes) {
            let processed = Number(i);
            if (processed && processed % 50 === 0) {
                const percentage =
                    (processed * 100) / uniqueTransactionHashes.length;
                console.log({
                    percentage,
                    processed,
                    total: uniqueTransactionHashes.length,
                });
                await updatePercentage(percentage.toFixed(0));
            }
            priorityFeeTransactions.push(
                await alchemyTransaction(uniqueTransactionHashes[i])
            );
        }
        await callback(
            priorityFeeTransactions.filter(
                (elem) =>
                    elem.priorityFee <= maxPriorityFee &&
                    elem.priorityFee >= minPriorityFee
            )
        );
    } catch (e) {
        console.log(e);
        errorCallback();
    }
};

/**
 * finds address with ethereum balance for the incomplete address
 * @param {string} addressQuery address to query, please make sure to add ... inplace of characters u don't know
 */
const queryEthereumAddresses = async (addressQuery) => {
    try {
        addressQuery = addressQuery.toLowerCase();
        addressQuery = addressQuery.replace(/\.\.\./g, "%");
        console.log({ addressQuery });
        const query = `
        SELECT *
        FROM \`bigquery-public-data.crypto_ethereum.balances\`
        WHERE address LIKE '${addressQuery}'
        ORDER BY eth_balance DESC
        LIMIT 50
      `;

        const options = {
            query: query,
            // location: 'US', // Change this to your desired location
        };

        const [job] = await bigquery.createQueryJob(options);
        const [rows] = await job.getQueryResults();

        // console.log("Query Results:");
        let addressAndBalance = [];
        rows.forEach((row) => {
            const balanceArray = row.eth_balance.c;

            // Convert the balance array to a string representation
            const balanceString = balanceArray.join("");

            // Parse the string as a decimal value
            const etherBalance = parseFloat(
                `${balanceString.slice(0, -18)}.${balanceString.slice(-18)}`
            );
            addressAndBalance.push({
                address: row.address,
                balance: etherBalance,
            });
        });
        return addressAndBalance;
    } catch (e) {
        console.log(e);
    }
};

module.exports = {
    erc20TokenTransferEvents,
    getInternalTransaction,
    getLastTransaction,
    subscribe,
    getTokenInfo,
    getTransactionsFromLastDayByContractAddress,
    queryEthereumAddresses,
    subscribeComplete,
};
