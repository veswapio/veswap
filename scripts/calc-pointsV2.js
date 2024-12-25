import fs from "fs";
import BigNumber from "bignumber.js";
import transactionRecords from "./transaction-recordsV2.json" with { type: "json" };

import path from 'path';
import { fileURLToPath } from 'url';


const END_TIMESTAMP = Math.ceil(new Date("2024-12-22 23:59:59.999").getTime() / 1000);

async function fetchTransactions(index) {
  return await fetch(`http://34.92.148.112/subgraphs/name/swap/swap`, {
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

console.log("Writing results to the transaction-recordsV2.json file...");

const txV2DataPath = path.join(__dirname, './transaction-recordsV2.json');

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

// let participantsIndex = 0;
let allParticipants = [];
// let reachedEndParticipants = false;
// const round = calcRound();

// console.log(`Starting to fetch participants of round ${round}...`);

// while (!reachedEndParticipants) {
//   try {
//     const participants = await fetchVoteParticipants(round, participantsIndex);

//     if (participants.length === 0) {
//       break;
//     }

//     for (const participant of participants) {
//       if (participant.timestamp > END_TIMESTAMP) {
//         reachedEndParticipants = true;
//         break;
//       }
//       allParticipants.push(participant);
//       participantsIndex += 1;
//     }

//     if (reachedEndParticipants || participants.length < 500) {
//       console.log("All participants has been fetched!");
//       break;
//     }
//   } catch (error) {
//     console.error("Error fetching participants:", error);
//     break;
//   }
// }

console.log("Starting to calculate user points...");

const START_TIMESTAMP = 1717516800; // 2024-06-05 00:00:00
const WEEK_START_TIMESTAMP = END_TIMESTAMP - 7 * 24 * 60 * 60;
const PERIOD = 12 * 60 * 60;
const CURRENT_PERIOD_INDEX = Math.ceil((END_TIMESTAMP - START_TIMESTAMP) / PERIOD);
const LIQUIDITY_BASE = 1000;
const SWAP_BASE = 50000;

const allPoints = allTransactions.reduce((a, c) => {
  let currentIndex = Math.ceil((c.timestamp - START_TIMESTAMP) / PERIOD);

  const isLastWeek = c.timestamp > WEEK_START_TIMESTAMP;
  const isDoubled = isLastWeek && allParticipants.includes(c.account);

  const user = a[c.account] || {
    addLiquidityPoints: [],
    addLiquidityTempBalance: 0,
    removeLiquidityPoints: [],
    removeLiquidityTempBalance: 0,
    swapPoints: 0,
    swapTempBalance: 0
  };

  if (c.type === "ADD_LIQUIDITY") {
    if (user.addLiquidityTempBalance + Number(c.amount) > LIQUIDITY_BASE) {
      const point = BigNumber(user.addLiquidityTempBalance)
        .plus(c.amount)
        .dividedBy(LIQUIDITY_BASE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
      user.addLiquidityPoints.push([point, currentIndex]);
      user.addLiquidityTempBalance = (user.addLiquidityTempBalance + Number(c.amount)) % LIQUIDITY_BASE;
    } else {
      user.addLiquidityTempBalance = BigNumber(user.addLiquidityTempBalance).plus(c.amount).toNumber();
    }
  } else if (c.type === "REMOVE_LIQUIDITY") {
    if (user.removeLiquidityTempBalance + Number(c.amount) > LIQUIDITY_BASE) {
      const point = BigNumber(user.removeLiquidityTempBalance)
        .plus(c.amount)
        .dividedBy(LIQUIDITY_BASE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
      user.removeLiquidityPoints.push([point, currentIndex]);
      user.removeLiquidityTempBalance = (user.removeLiquidityTempBalance + Number(c.amount)) % LIQUIDITY_BASE;
    } else {
      user.removeLiquidityTempBalance = BigNumber(user.removeLiquidityTempBalance).plus(c.amount).toNumber();
    }
  } else if (c.type === "SWAP") {
    if (user.swapTempBalance + Number(c.amount) > SWAP_BASE) {
      const point = BigNumber(user.swapTempBalance)
        .plus(c.amount)
        .dividedBy(SWAP_BASE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
      user.swapPoints += point;
      user.swapTempBalance = (user.swapTempBalance + Number(c.amount)) % SWAP_BASE;
    } else {
      user.swapTempBalance = BigNumber(user.swapTempBalance).plus(c.amount).toNumber();
    }
  }

  a[c.account] = user;
  return a;
}, {});

console.log("Starting to calculate user weekly points...");

const allWeeklyPoints = allTransactions
  .filter((i) => i.timestamp >= WEEK_START_TIMESTAMP)
  .reduce((a, c) => {
    let currentIndex = Math.ceil((c.timestamp - START_TIMESTAMP) / PERIOD);
    const isDoubled = allParticipants.includes(c.account);

    const user = a[c.account] || {
      addLiquidityPoints: [],
      addLiquidityTempBalance: 0,
      removeLiquidityPoints: [],
      removeLiquidityTempBalance: 0,
      swapPoints: 0,
      swapTempBalance: 0,
      isDoubled
    };

    if (c.type === "ADD_LIQUIDITY") {
      if (user.addLiquidityTempBalance + Number(c.amount) > LIQUIDITY_BASE) {
        const point = BigNumber(user.addLiquidityTempBalance)
          .plus(c.amount)
          .dividedBy(LIQUIDITY_BASE)
          .integerValue(BigNumber.ROUND_DOWN)
          .toNumber();
        user.addLiquidityPoints.push([point, currentIndex]);
        user.addLiquidityTempBalance = (user.addLiquidityTempBalance + Number(c.amount)) % LIQUIDITY_BASE;
      } else {
        user.addLiquidityTempBalance = BigNumber(user.addLiquidityTempBalance).plus(c.amount).toNumber();
      }
    } else if (c.type === "REMOVE_LIQUIDITY") {
      if (user.removeLiquidityTempBalance + Number(c.amount) > LIQUIDITY_BASE) {
        const point = BigNumber(user.removeLiquidityTempBalance)
          .plus(c.amount)
          .dividedBy(LIQUIDITY_BASE)
          .integerValue(BigNumber.ROUND_DOWN)
          .toNumber();
        user.removeLiquidityPoints.push([point, currentIndex]);
        user.removeLiquidityTempBalance = (user.removeLiquidityTempBalance + Number(c.amount)) % LIQUIDITY_BASE;
      } else {
        user.removeLiquidityTempBalance = BigNumber(user.removeLiquidityTempBalance).plus(c.amount).toNumber();
      }
    } else if (c.type === "SWAP") {
     if (user.swapTempBalance + Number(c.amount) > SWAP_BASE) {
        const point = BigNumber(user.swapTempBalance)
          .plus(c.amount)
          .dividedBy(SWAP_BASE)
          .integerValue(BigNumber.ROUND_DOWN)
          .toNumber();
        user.swapPoints += point;
        user.swapTempBalance = (user.swapTempBalance + Number(c.amount)) % SWAP_BASE;
      } else {
        user.swapTempBalance = BigNumber(user.swapTempBalance).plus(c.amount).toNumber();
      }
    }

    a[c.account] = user;
    return a;
  }, {});

// only for debug
const pointRcV2DataPath = path.join(__dirname, './point-recordsV2.json');
fs.writeFileSync(pointRcV2DataPath, JSON.stringify(allPoints, null, 2));

console.log("Starting to sort user points...");

const sortedPointsArray = Object.entries(allPoints)
  .map(([account, data]) => {
    const addedPoints = data.addLiquidityPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, BigNumber(0));

    const removedPoints = data.removeLiquidityPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, BigNumber(0));

    if (removedPoints.isGreaterThan(addedPoints)) {
      console.log(account);
    }

    return {
      account: account,
      points: addedPoints.minus(removedPoints).plus(data.swapPoints)
    };
  })
  // .filter((i) => i.points.isGreaterThan(0))
  .sort((a, b) => b.points.minus(a.points).toNumber());

console.log("Starting to sort user weekly points...");

const weeklySortedWeeklyPointsArray = Object.entries(allWeeklyPoints)
  .map(([account, data]) => {
    const addedPoints = data.addLiquidityPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, BigNumber(0));

    const removedPoints = data.removeLiquidityPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, BigNumber(0));

    return {
      account: account,
      points: addedPoints.minus(removedPoints).plus(data.swapPoints),
      isDoubled: data.isDoubled
    };
  })
  // .filter((i) => i.points.isGreaterThan(0))
  .sort((a, b) => b.points.minus(a.points).toNumber());

console.log("Writing points to the src/data/pointsV2.json file...");

const pointsV2DataPath = path.join(__dirname, '../src/data/pointsV2.ts');
console.log(pointsV2DataPath);


fs.writeFileSync(
  pointsV2DataPath,
  `export const totalPoints = ${JSON.stringify(sortedPointsArray)};
   export const weeklyPoints = ${JSON.stringify(weeklySortedWeeklyPointsArray)};`
);

console.log("All Done!");
