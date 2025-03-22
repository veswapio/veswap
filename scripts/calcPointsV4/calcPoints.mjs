import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import moment from "moment";
import BigNumber from "bignumber.js";
import { parse } from "csv-parse/sync";
import { totalPoints, pointsLog } from "./lockedPoints.js";
import { END_TIME, ENABLE_DEBUG, DEBUG_ADDRESS } from "./config.js";
// import { proviousWovPoints } from "./lockedWovLiquidityPoints.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (ENABLE_DEBUG) {
  console.log("DEBUG_ADDRESS", DEBUG_ADDRESS);
}

// Start time
const startMoment = moment.utc(END_TIME).clone().startOf("isoWeek");
const START_TIME = Math.floor(startMoment.valueOf() / 1000);

// Current week label
function getWeekLabel(m) {
  const mUtc = m.clone().utc();
  const isoYear = mUtc.isoWeekYear();
  const isoWeek = mUtc.isoWeek();
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}
const currentWeekLabel = getWeekLabel(startMoment);

// Get week number
function getWeekNumberFromTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  const baseDate = new Date(Date.UTC(2025, 2, 10, 0, 0, 0, 0));
  const baseWeek = 37;
  const dateDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const baseDateDay = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
  const diffTime = dateDay.getTime() - baseDateDay.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const weekDiff = Math.floor(diffDays / 7);
  const weekNumber = baseWeek + weekDiff;

  return weekNumber;
}

const WEEK_INDEX = getWeekNumberFromTimestamp(START_TIME);

// Calc user liquitiy balance before START_TIME
// --------------------------------------------

const userLiquidity = {};
const userPoints = {};
const pastRecords = [];
const currentRecords = [];

const csvData = fs.readFileSync("./_transaction-recordsV4.csv", "utf8");
const records = parse(csvData, {
  columns: ["type", "timestamp", "account", "amount", "txHash", "pair"],
  skip_empty_lines: true,
  cast: (value, context) => {
    if (context.column === "timestamp" || context.column === "amount") {
      return Number(value);
    }
    return value;
  }
});
records.sort((a, b) => a.timestamp - b.timestamp);

for (let i = 0; i < records.length; i++) {
  if (records[i].timestamp < START_TIME && records[i].type !== "SWAP") {
    pastRecords.push(records[i]);
  } else {
    currentRecords.push(records[i]);
  }
}

pastRecords.forEach((record) => {
  const { type, account, amount, pair } = record;

  if (!userLiquidity[account]) {
    userLiquidity[account] = {};
  }

  if (!userLiquidity[account][pair]) {
    userLiquidity[account][pair] = BigNumber(0);
  }

  const amountBN = BigNumber(amount);
  if (type === "ADD_LIQUIDITY") {
    userLiquidity[account][pair] = userLiquidity[account][pair].plus(amountBN);
  } else if (type === "REMOVE_LIQUIDITY") {
    userLiquidity[account][pair] = BigNumber.maximum(userLiquidity[account][pair].minus(amountBN), BigNumber(0));
  }
});

if (ENABLE_DEBUG) {
  console.log("Past total liquidity: ", userLiquidity[DEBUG_ADDRESS] || 0);
}

// Calc liquitiy balance every 6 hours from START_TIME to END_TIME
// ---------------------------------------------------------------

const SIX_HOURS_IN_SECONDS = 6 * 60 * 60;
const liquiditySlots = Array.from({ length: 28 }, (_, i) => START_TIME + (i + 1) * SIX_HOURS_IN_SECONDS);

liquiditySlots.forEach((slotEndTime, slotIndex) => {
  const slotStartTime = slotIndex === 0 ? START_TIME : liquiditySlots[slotIndex - 1];

  const slotRecords = currentRecords.filter(
    (record) => record.timestamp >= slotStartTime && record.timestamp < slotEndTime && record.type !== "SWAP"
  );

  slotRecords.forEach((record) => {
    const { type, account, amount, pair } = record;

    if (!userLiquidity[account]) {
      userLiquidity[account] = {};
    }

    if (!userLiquidity[account][pair]) {
      userLiquidity[account][pair] = BigNumber(0);
    }

    const amountBN = BigNumber(amount);
    if (type === "ADD_LIQUIDITY") {
      userLiquidity[account][pair] = userLiquidity[account][pair].plus(amountBN);
    } else if (type === "REMOVE_LIQUIDITY") {
      userLiquidity[account][pair] = BigNumber.maximum(userLiquidity[account][pair].minus(amountBN), BigNumber(0));
    }

    if (ENABLE_DEBUG && account.toLowerCase() === DEBUG_ADDRESS) {
      console.log(
        `Slot ${String(slotIndex + 1).padStart(2, "0")} liquidity action: `,
        pair,
        type,
        +userLiquidity[account][pair].toFixed(2)
      );
    }
  });

  Object.entries(userLiquidity).forEach(([account, userPairLiquidityMap]) => {
    if (!userPoints[account]) {
      userPoints[account] = {
        liquidityTotalPoints: 0
      };
    }

    let slotTotalPoints = 0;

    Object.keys(userPairLiquidityMap).forEach((pair) => {
      if (!userPoints[account][pair]) {
        userPoints[account][pair] = 0;
      }

      const liquidity = userLiquidity[account][pair];

      let points = 0;

      if (liquidity.gte(9999)) {
        const multiplier = Math.floor(liquidity / 9999);
        if (pair === "VVET/B3TR") {
          points = Math.min(multiplier * 0.5, 5);
        } else {
          points = Math.min(multiplier * 0.05, 0.5);
        }
      }
      userPoints[account][pair] += points;
      slotTotalPoints += points;

      if (ENABLE_DEBUG && account.toLowerCase() === DEBUG_ADDRESS) {
        console.log(`Slot ${String(slotIndex + 1).padStart(2, "0")} liquidity points: `, pair, +points.toFixed(2));
      }
    });
    userPoints[account].liquidityTotalPoints += slotTotalPoints;
  });
});

if (ENABLE_DEBUG) {
  console.log(
    "Round total liquidity points: ",
    userPoints[DEBUG_ADDRESS] && userPoints[DEBUG_ADDRESS].liquidityTotalPoints
      ? +userPoints[DEBUG_ADDRESS].liquidityTotalPoints.toFixed(2)
      : 0
  );
}

// Calc swap points
// ----------------

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
const swapSlots = Array.from({ length: 7 }, (_, i) => START_TIME + (i + 1) * ONE_DAY_IN_SECONDS);

swapSlots.forEach((slotEndTime, slotIndex) => {
  const slotStartTime = slotIndex === 0 ? START_TIME : swapSlots[slotIndex - 1];

  const slotRecords = currentRecords.filter(
    (record) => record.timestamp >= slotStartTime && record.timestamp < slotEndTime && record.type === "SWAP"
  );

  const slotSwaps = {};

  slotRecords.forEach((record) => {
    const { account, amount } = record;

    if (!slotSwaps[account]) {
      slotSwaps[account] = BigNumber(amount);
    } else {
      slotSwaps[account] = slotSwaps[account].plus(amount);
    }

    if (ENABLE_DEBUG && account.toLowerCase() === DEBUG_ADDRESS) {
      console.log(`Day ${slotIndex + 1} swap amount: `, +amount.toFixed(2));
    }
  });

  if (ENABLE_DEBUG) {
    console.log(
      `Day ${slotIndex + 1} total swap amount: `,
      slotSwaps[DEBUG_ADDRESS] ? slotSwaps[DEBUG_ADDRESS].toString() : 0
    );
  }

  Object.keys(slotSwaps).forEach((account) => {
    if (!userPoints[account]) {
      userPoints[account] = {
        daily: [],
        swapTotalPoints: 0
      };
    } else {
      if (!userPoints[account].daily) {
        userPoints[account].daily = [];
      }
      if (!userPoints[account].swapTotalPoints) {
        userPoints[account].swapTotalPoints = 0;
      }
    }

    while (userPoints[account].daily.length < slotIndex) {
      userPoints[account].daily.push(0);
    }

    const swapAmount = slotSwaps[account];
    let dailyPoints = 0;

    if (swapAmount >= 9999) {
      const multiplier = Math.floor(swapAmount / 9999);
      dailyPoints = Math.min(multiplier, 4);
    }

    userPoints[account].daily.push(dailyPoints);
    userPoints[account].swapTotalPoints += dailyPoints;

    if (ENABLE_DEBUG && account.toLowerCase() === DEBUG_ADDRESS) {
      console.log(`Day ${slotIndex + 1} swap points: `, +dailyPoints.toFixed(2));
    }
  });
});

if (ENABLE_DEBUG) {
  console.log(
    "Round total swap points: ",
    userPoints[DEBUG_ADDRESS] && userPoints[DEBUG_ADDRESS].swapTotalPoints
      ? +userPoints[DEBUG_ADDRESS].swapTotalPoints.toFixed(2)
      : 0
  );
}

fs.writeFileSync(`./round-points/round-${WEEK_INDEX}-points.json`, JSON.stringify(userPoints, null, 2));

// Calc total points
// -----------------

// total points
let _totalPoints = totalPoints;
Object.entries(userPoints).forEach(([account, points]) => {
  const liquidityTotalPoints = points.liquidityTotalPoints || 0;
  const swapTotalPoints = points.swapTotalPoints || 0;
  if (liquidityTotalPoints + swapTotalPoints === 0) return;
  const idx = _totalPoints.findIndex((i) => i.account === account);
  if (idx === -1) {
    _totalPoints.push({
      account,
      points: +(liquidityTotalPoints + swapTotalPoints).toFixed(2)
    });
  } else {
    _totalPoints[idx] = {
      account,
      points: +(_totalPoints[idx].points + liquidityTotalPoints + swapTotalPoints).toFixed(2)
    };
  }
});
_totalPoints.sort((a, b) => b.points - a.points);

// provious wov liquidity points
// Object.entries(proviousWovPoints).forEach(([account, points]) => {
//   const wovPoints = +(points.liquidityTotalPoints || 0).toFixed(2);
//   if (!wovPoints) return;
//   const idx = _totalPoints.findIndex((i) => i.account === account);
//   if (idx === -1) {
//     _totalPoints.push({
//       account,
//       points: wovPoints
//     });
//   } else {
//     _totalPoints[idx] = {
//       account,
//       points: +(_totalPoints[idx].points + wovPoints).toFixed(2)
//     };
//   }
// });
// _totalPoints.sort((a, b) => b.points - a.points);

// weekly points
const _weeklyPoinst = [];
Object.entries(userPoints).forEach(([account, points]) => {
  const liquidityTotalPoints = points.liquidityTotalPoints || 0;
  const swapTotalPoints = points.swapTotalPoints || 0;
  if (liquidityTotalPoints + swapTotalPoints === 0) return;
  _weeklyPoinst.push({
    account,
    points: +(liquidityTotalPoints + swapTotalPoints).toFixed(2)
  });
});
_weeklyPoinst.sort((a, b) => b.points - a.points);

// user points log
const _pointsLog = pointsLog;
Object.entries(userPoints).forEach(([account, points]) => {
  const liquidityTotalPoints = points.liquidityTotalPoints || 0;
  const swapTotalPoints = points.swapTotalPoints || 0;
  if (liquidityTotalPoints + swapTotalPoints === 0) return;
  const entry = {
    originalWeek: currentWeekLabel,
    weekIndex: WEEK_INDEX,
    swapPoints: +swapTotalPoints.toFixed(2),
    liquidityPoints: +liquidityTotalPoints.toFixed(2),
    totalPoints: _totalPoints.find((i) => i.account === account).points
  };

  if (_pointsLog[account]) {
    _pointsLog[account].unshift(entry);
  } else {
    _pointsLog[account] = [entry];
  }
});

// trading statistics
const _tradingStatistics = records.reduce(
  (acc, current) => {
    const timestamp = parseInt(current.timestamp) * 1000;
    const date = new Date(timestamp);

    if (current.type === "SWAP") {
      acc.totalSwapVolume += parseFloat(current.amount);
      acc.totalSwapTransactions++;

      if (!acc.uniqueTraders.includes(current.account)) {
        acc.uniqueTraders.push(current.account);
      }
    }

    if (date.getFullYear() >= 2025) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!acc.monthlyStats[monthKey]) {
        acc.monthlyStats[monthKey] = {
          transactions: 0,
          volume: 0,
          uniqueTraders: 0,
          traders: new Set()
        };
      }

      acc.monthlyStats[monthKey].transactions++;
      acc.monthlyStats[monthKey].volume += parseFloat(current.amount);

      if (!acc.monthlyStats[monthKey].traders.has(current.account)) {
        acc.monthlyStats[monthKey].traders.add(current.account);
        acc.monthlyStats[monthKey].uniqueTraders++;
      }
    }

    return acc;
  },
  {
    totalSwapVolume: 0,
    totalSwapTransactions: 0,
    uniqueTraders: [],
    monthlyStats: {}
  }
);

_tradingStatistics.uniqueTraders = _tradingStatistics.uniqueTraders.length;

Object.keys(_tradingStatistics.monthlyStats).forEach((month) => {
  delete _tradingStatistics.monthlyStats[month].traders;
});

fs.writeFileSync(
  path.join(__dirname, "../../src/data/pointsV4.ts"),
  `export const totalPoints = ${JSON.stringify(_totalPoints)};
export const weeklyPoints = ${JSON.stringify(_weeklyPoinst)};
export const pointsLog: Record<string, any> = ${JSON.stringify(_pointsLog)};
export const tradingStatistics = ${JSON.stringify(_tradingStatistics)};`
);
