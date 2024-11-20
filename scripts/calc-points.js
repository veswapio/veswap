import fs from "fs";
import BigNumber from "bignumber.js";
import transactionRecords from "./transaction-records.json" with { type: "json" };
import pointRecords from "./point-records.json" with { type: "json" };

const END_TIMESTAMP = Math.ceil(new Date("2024-09-01 23:59:59.999").getTime() / 1000);

async function fetchTransactions(index) {
  return await fetch(`https://subgraph.veswap.org/subgraphs/name/swap/swap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `{
        transactions(orderDirection: asc, orderBy: timestamp, first: 500, skip: ${index}) {
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
                amount
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
                amount
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
                amount
              };
            })
          );
        }

        return a;
      }, []);
    });
}

async function fetchVoteParticipants(round, index) {
  return await fetch(`https://graph.vet/subgraphs/name/vebetter/dao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: `{
        round(id: "${round}") {
          id
          apps {
            participants(
              where: {app: "0x899de0d0f0b39e484c8835b2369194c4c102b230c813862db383d44a4efe14d3"}
              first: 500,
              skip: ${index}
            ) {
              id
              app {
                name
              }
            }
          }
        }
      }`
    })
  })
    .then((res) => res.json())
    .then(({ data }) => {
      const { participants } = data.round.apps.find((i) => !!i.participants.length);
      return participants.map((i) => i.id.split("/")[0]);
    });
}

function calcRound() {
  const startTime = 1719792000; // Mon Jul 01 2024 00:00:00 GMT+0000
  const currentTime = Math.floor(Date.now() / 1000);
  const interval = 60 * 60 * 24 * 7; // 1 week
  return Math.ceil((currentTime - startTime) / interval) - 1;
}

let transactionIndex = transactionRecords.transactionIndex || 0;
let allTransactions = transactionRecords.allTransactions || [];
let reachedEndTime = false;

console.log(`Starting to fetch transactions from index ${transactionIndex}`);

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

console.log("Writing results to the transaction-records.json file...");

fs.writeFileSync(
  "./transaction-records.json",
  JSON.stringify(
    {
      transactionIndex,
      allTransactions
    },
    null,
    2
  )
);

let participantsIndex = 0;
let allParticipants = [];
let reachedEndParticipants = false;
const round = calcRound();

console.log(`Starting to fetch participants of round ${round}...`);

while (!reachedEndParticipants) {
  try {
    const participants = await fetchVoteParticipants(round, participantsIndex);

    if (participants.length === 0) {
      break;
    }

    for (const participant of participants) {
      if (participant.timestamp > END_TIMESTAMP) {
        reachedEndParticipants = true;
        break;
      }
      allParticipants.push(participant);
      participantsIndex += 1;
    }

    if (reachedEndParticipants || participants.length < 500) {
      console.log("All participants has been fetched!");
      break;
    }
  } catch (error) {
    console.error("Error fetching participants:", error);
    break;
  }
}

console.log("Starting to calculate user points...");

const START_TIMESTAMP = 1717516800; // 2024-06-05 00:00:00
const WEEK_START_TIMESTAMP = END_TIMESTAMP - 7 * 24 * 60 * 60;
const PERIOD = 12 * 60 * 60;
const CURRENT_PERIOD_INDEX = Math.ceil((END_TIMESTAMP - START_TIMESTAMP) / PERIOD);
const LIQUIDITY_BASE = 1000;
const SWAP_BASE = 50000;

let periodIndex = 0;
let weeklyPoints = {};

const allPoints = allTransactions.reduce((a, c) => {
  if (Math.ceil((c.timestamp - START_TIMESTAMP) / PERIOD) > periodIndex) {
    periodIndex = Math.ceil(c.timestamp / PERIOD);
  }

  const isLastWeek = c.timestamp > WEEK_START_TIMESTAMP;
  const isDouble = isLastWeek && allParticipants.includes(c.account);

  const user = a[c.account] || {
    addLiquidityPoints: [],
    addLiquidityTempBalance: 0,
    removeLiquidityPoints: [],
    removeLiquidityTempBalance: 0,
    swapPoints: 0,
    swapTempBalance: 0
  };

  if (c.type === "ADD_LIQUIDITY") {
    if (c.amount > LIQUIDITY_BASE) {
      const point = BigNumber(c.amount).dividedBy(LIQUIDITY_BASE).integerValue(BigNumber.ROUND_DOWN).toNumber();
      user.addLiquidityPoints.push([isDouble ? point * 2 : point, periodIndex]);
      user.addLiquidityTempBalance = c.amount % LIQUIDITY_BASE;
    } else if (user.addLiquidityTempBalance + c.amount > LIQUIDITY_BASE) {
      const point = BigNumber(user.addLiquidityTempBalance)
        .plus(c.amount)
        .dividedBy(LIQUIDITY_BASE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
      user.addLiquidityPoints.push([point, periodIndex]);
      user.addLiquidityTempBalance = (user.addLiquidityTempBalance + c.amount) % LIQUIDITY_BASE;
    } else {
      user.addLiquidityTempBalance = BigNumber(user.addLiquidityTempBalance).plus(c.amount).toNumber();
    }
  } else if (c.type === "REMOVE_LIQUIDITY") {
    if (c.amount > LIQUIDITY_BASE) {
      const point = BigNumber(c.amount).dividedBy(LIQUIDITY_BASE).integerValue(BigNumber.ROUND_DOWN).toNumber();
      user.removeLiquidityPoints.push([isDouble ? point * 2 : point, periodIndex]);
      user.removeLiquidityTempBalance = c.amount % LIQUIDITY_BASE;
    } else if (user.removeLiquidityTempBalance + c.amount > LIQUIDITY_BASE) {
      const point = BigNumber(user.removeLiquidityTempBalance)
        .plus(c.amount)
        .dividedBy(LIQUIDITY_BASE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
      user.removeLiquidityPoints.push([point, periodIndex]);
      user.removeLiquidityTempBalance = (user.removeLiquidityTempBalance + c.amount) % LIQUIDITY_BASE;
    } else {
      user.removeLiquidityTempBalance = BigNumber(user.removeLiquidityTempBalance).plus(c.amount).toNumber();
    }
  } else if (c.type === "SWAP") {
    if (c.amount > SWAP_BASE) {
      const point = BigNumber(c.amount).dividedBy(SWAP_BASE).integerValue(BigNumber.ROUND_DOWN).toNumber();
      user.swapPoints += isDouble ? point * 2 : point;
      user.swapTempBalance = c.amount % SWAP_BASE;
    } else if (user.swapTempBalance + c.amount > SWAP_BASE) {
      const point = BigNumber(user.swapTempBalance)
        .plus(c.amount)
        .dividedBy(SWAP_BASE)
        .integerValue(BigNumber.ROUND_DOWN)
        .toNumber();
      user.swapPoints += point;
      user.swapTempBalance = (user.swapTempBalance + c.amount) % SWAP_BASE;
    } else {
      user.swapTempBalance = BigNumber(user.swapTempBalance).plus(c.amount).toNumber();
    }
  }

  a[c.account] = user;
  if (isLastWeek) weeklyPoints[c.account] = user;

  return a;
}, pointRecords);

console.log("Writing results to the point-records.json file...");

fs.writeFileSync("./point-records.json", JSON.stringify(allPoints, null, 2));

console.log("Starting to sort user points...");

const sortedPointsArray = Object.entries(allPoints)
  .map((account, data) => {
    const addedPoints = data.addLiquidityPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, 0);

    const removedPoints = data.removeLiquidityPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, 0);

    const swapsPoints = data.swapPoints.reduce((a, c) => {
      const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
      return BigNumber(a).plus(point);
    }, 0);

    return {
      account: account,
      points: addedPoints.minus(removedPoints).plus(swapsPoints)
    };
  })
  .sort((a, b) => a.points - b.points);

const addedPoints = data.addLiquidityPoints.reduce((a, c) => {
  const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
  return BigNumber(a).plus(point);
}, 0);

const removedPoints = data.removeLiquidityPoints.reduce((a, c) => {
  const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
  return BigNumber(a).plus(point);
}, 0);

const swapsPoints = data.swapPoints.reduce((a, c) => {
  const point = BigNumber(c[0]).times(CURRENT_PERIOD_INDEX - c[1]);
  return BigNumber(a).plus(point);
}, 0);

console.log(weeklySortedWeeklyPointsArray); // TODO

console.log("Writing points to the src/data/points.json file...");

fs.writeFileSync(
  "../src/data/points.ts",
  `export const totalPoints = ${JSON.stringify(sortedPointsArray)};
  export const weeklyPoints = ${JSON.stringify(weeklySortedWeeklyPointsArray)};`
);

console.log("All Done!");