import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { fileURLToPath } from "url";
import BigNumber from "bignumber.js";
import { TRANSACTION_INDEX, END_TIME } from "./config.js";

const END_TIMESTAMP = Math.floor(new Date(END_TIME).getTime() / 1000);

async function fetchTransactions(index) {
  return await fetch(`http://34.150.93.179/subgraphs/name/swap/swap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `{
        transactions(orderDirection: asc, orderBy: timestamp, first: 500, skip: ${index}) {
          id
          timestamp
          burns {
            timestamp
            amount0
            amount1
            sender
            pair {
              token0 {
                symbol
              }
              token1 {
                symbol
              }
            }
          }
          mints {
            timestamp
            amount0
            amount1
            to
            origin
            pair {
              token0 {
                symbol
              }
              token1 {
                symbol
              }
            }
          }
          swaps {
            timestamp
            amount0In
            amount0Out
            amount1In
            amount1Out
            to
            origin
            pair {
              token0 {
                symbol
              }
              token1 {
                symbol
              }
            }
          }
        }
      }`
    })
  }).then((res) => res.json());
}

let transactionIndex = TRANSACTION_INDEX;
let allTransactions = [];
let reachedEndTime = false;

console.log(`Starting to fetch transactions from index ${transactionIndex}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

while (!reachedEndTime) {
  try {
    const { data } = await fetchTransactions(transactionIndex);

    for (const c of data.transactions) {
      if (c.timestamp > END_TIMESTAMP) {
        reachedEndTime = true;
        break;
      }

      transactionIndex += 1;

      if (c.burns.length > 0) {
        allTransactions.push(
          ...c.burns.map((burn) => {
            let amount;
            if (burn.pair.token0.symbol === "VVET") {
              amount = BigNumber(burn.amount0).times(2);
            } else if (burn.pair.token1.symbol === "VVET") {
              amount = BigNumber(burn.amount1).times(2);
            } else {
              amount = 0; // TODO
            }

            return {
              type: "REMOVE_LIQUIDITY",
              timestamp: burn.timestamp,
              account: burn.sender,
              amount,
              txHash: c.id,
              pair: burn.pair.token0.symbol + "/" + burn.pair.token1.symbol
            };
          })
        );
      } else if (c.mints.length > 0) {
        allTransactions.push(
          ...c.mints.map((mint) => {
            let amount;
            if (mint.pair.token0.symbol === "VVET") {
              amount = BigNumber(mint.amount0).times(2);
            } else if (mint.pair.token1.symbol === "VVET") {
              amount = BigNumber(mint.amount1).times(2);
            } else {
              amount = 0; // TODO
            }

            return {
              type: "ADD_LIQUIDITY",
              timestamp: mint.timestamp,
              account: mint.origin,
              amount,
              txHash: c.id,
              pair: mint.pair.token0.symbol + "/" + mint.pair.token1.symbol
            };
          })
        );
      } else if (c.swaps.length > 0) {
        allTransactions.push(
          ...c.swaps.map((swap) => {
            let amount;
            if (swap.pair.token0.symbol === "VVET") {
              amount = BigNumber(swap.amount0In - swap.amount0Out).abs();
            } else if (swap.pair.token1.symbol === "VVET") {
              amount = BigNumber(swap.amount1In - swap.amount1Out).abs();
            } else {
              amount = 0; // TODO
            }

            return {
              type: "SWAP",
              timestamp: swap.timestamp,
              account: swap.origin,
              amount,
              txHash: c.id,
              pair: swap.pair.token0.symbol + "/" + swap.pair.token1.symbol
            };
          })
        );
      }
    }

    console.log("log", data.transactions.length, transactionIndex);

    if (reachedEndTime) {
      console.log("All transactions has been fetched!");
      break;
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    break;
  }
}

// Append new transactions
const txCsvPath = path.join(__dirname, "./_transaction-recordsV4.csv");
// ["type", "timestamp", "account", "amount", "txHash", "pair"];
const rows = allTransactions.map((tx) => [tx.type, tx.timestamp, tx.account, tx.amount.toString(), tx.txHash, tx.pair]);
const csvContent = stringify(rows);
fs.appendFileSync(txCsvPath, csvContent);

// Updatethe transaction index in the config file
const configPath = path.join(__dirname, "./config.js");
const configContent = fs.readFileSync(configPath, "utf8");
const updatedConfigContent = configContent.replace(
  /export const TRANSACTION_INDEX = \d+;/,
  `export const TRANSACTION_INDEX = ${transactionIndex};`
);
fs.writeFileSync(configPath, updatedConfigContent);

// All done
console.log("Finished writing results.");
