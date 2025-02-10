import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import BigNumber from "bignumber.js";
import { END_TIME } from "./config.js";
import transactionRecords from "./_transaction-recordsV3.json" with { type: "json" };

const END_TIMESTAMP = Math.ceil(new Date(END_TIME).getTime() / 1000);

async function fetchTransactions(index) {
  return await fetch(`http://35.241.81.247/subgraphs/name/swap/swap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `{
        transactions(orderDirection: asc, orderBy: timestamp, first: 500, skip: ${index}) {
          id
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
  })
    .then((res) => res.json())
    .then(({ data: { transactions } }) => {
      return transactions.reduce((a, c) => {
        if (c.burns.length > 0) {
          a.push(
            ...c.burns.map((burn) => {
              let amount;
              if (burn.pair.token0.symbol === "VVET") {
                amount = BigNumber(burn.amount0);
              } else if (burn.pair.token1.symbol === "VVET") {
                amount = BigNumber(burn.amount1);
              } else {
                throw new Error("VTHO/B3TR Pair");
              }

              return {
                type: "REMOVE_LIQUIDITY",
                timestamp: burn.timestamp,
                account: burn.sender,
                amount,
                txHash: c.id
              };
            })
          );
        } else if (c.mints.length > 0) {
          a.push(
            ...c.mints.map((mint) => {
              let amount;
              if (mint.pair.token0.symbol === "VVET") {
                amount = BigNumber(mint.amount0);
              } else if (mint.pair.token1.symbol === "VVET") {
                amount = BigNumber(mint.amount1);
              } else {
                throw new Error("VTHO/B3TR Pair");
              }

              return {
                type: "ADD_LIQUIDITY",
                timestamp: mint.timestamp,
                account: mint.to,
                amount,
                txHash: c.id
              };
            })
          );
        } else if (c.swaps.length > 0) {
          a.push(
            ...c.swaps.map((swap) => {
              let amount;
              if (swap.pair.token0.symbol === "VVET") {
                amount = BigNumber(swap.amount0In - swap.amount0Out).abs();
              } else if (swap.pair.token1.symbol === "VVET") {
                amount = BigNumber(swap.amount1In - swap.amount1Out).abs();
              } else {
                throw new Error("VTHO/B3TR Pair");
              }

              return {
                type: "SWAP",
                timestamp: swap.timestamp,
                account: swap.to,
                amount,
                txHash: c.id
              };
            })
          );
        }

        return a;
      }, []);
    });
}

let transactionIndex = transactionRecords.transactionIndex || 0;
let allTransactions = transactionRecords.allTransactions || [];
let reachedEndTime = false;

console.log(`Starting to fetch transactions from index ${transactionIndex}`);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

while (!reachedEndTime) {
  try {
    const transactions = await fetchTransactions(transactionIndex);

    if (transactions.length === 0) {
      break;
    }

    for (const transaction of transactions) {
      if (transaction.timestamp > END_TIMESTAMP) {
        reachedEndTime = true;
        break;
      }
      allTransactions.push(transaction);
      transactionIndex += 1;
    }

    if (reachedEndTime || transactions.length < 500) {
      console.log("All transactions has been fetched!");
      break;
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    break;
  }
}

const txV2DataPath = path.join(__dirname, "./_transaction-recordsV3.json");

fs.writeFileSync(
  txV2DataPath,
  JSON.stringify(
    {
      transactionIndex,
      allTransactions
    },
    null,
    2
  )
);

console.log("Finished writing results to the _transaction-recordsV3.json file.");
