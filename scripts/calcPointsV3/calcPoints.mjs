import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import moment from "moment";
import { END_TIME, ENABLE_DEBUG, DEBUG_ADDRESS } from "./config.js";
// import transactionRecords from "./_transaction-recordsTEST.json" with { type: "json" };
import transactionRecords from "./_transaction-recordsV3.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THRESHOLD = 9999;

if (ENABLE_DEBUG) {
  console.log("Account: ", DEBUG_ADDRESS);
}

// ---------------------- 全局配置(UTC + 周日截止) ----------------------
moment.updateLocale("en", {
  // dow=1 => 周一是一周第一天 (因此周日是一周最后一天)
  // doy=4 => 符合 ISO 规则，即一年含1月4日的那周 为 第1周
  week: {
    dow: 1,
    doy: 4
  }
});

const END_TIMESTAMP = moment.utc(END_TIME).unix();

const ONE_DAY_SECONDS = 86400;
const SEVEN_DAYS_SECONDS = 7 * ONE_DAY_SECONDS;

/** 每周流动性积分封顶 */
const MAX_WEEKLY_LIQ_POINTS = 140;
/** 每 7 天、每 10000 (THRESHOLD) 元 => 14 分 */
const LIQ_POINTS_PER_7D_PER_10K = 14;
/** 每日最多可得 SWAP 积分 4 分 */
const MAX_SWAP_POINTS_PER_DAY = 4;

/**
 * userPoints[account] => 总积分 (流动性 + SWAP)
 */
const userPoints = {};

/**
 * userWeeklyLiquidityPoints[account][weekLabel] => 本周【流动性】积分已领取多少
 */
const userWeeklyLiquidityPoints = {};

/**
 * 记录周积分明细:
 *   userWeeklyPointsBreakdown[account][weekLabel] = {
 *     swapPoints: number,
 *     liquidityPoints: number
 *   }
 */
const userWeeklyPointsBreakdown = {};

/**
 * userDailySwapVolumes[account]["YYYY-MM-DD"] => 当天的 swap 总量
 */
const userDailySwapVolumes = {};

/**
 * 用于追踪“10k 单元”。
 * 格式：
 *   {
 *     unitId: number,      // 自增ID
 *     owner: string,       // 当前持有人
 *     startTime: number,   // 该单元生效的 UTC秒
 *     isActive: boolean,   // 是否还在用户手中
 *     claimedCycles: number // 已发过多少次(满7天)了
 *   }
 */
let unitList = [];
let nextUnitId = 1; // 自增ID

/**
 * 维护一个 leftoverMap： user => (不足 10,000 的尾巴金额)
 * 每次 ADD_LIQUIDITY 时，需要先将 leftover + amount 合并，再拆出多少个 10k 单元
 */
const userLeftoverMap = {};

// ---------------------- 帮助函数 ----------------------

function toMomentUTC(unixSec) {
  return moment.utc(unixSec, "X");
}

function getWeekLabel(m) {
  const mUtc = m.clone().utc();
  const isoYear = mUtc.isoWeekYear();
  const isoWeek = mUtc.isoWeek();
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}

/**
 * 给某用户发放流动性积分(需检查周封顶)
 */
function awardLiquidityPoints(account, awardingTimeUnix, pointsToAdd) {
  const awardingMoment = toMomentUTC(awardingTimeUnix);
  const weekLabel = getWeekLabel(awardingMoment);

  if (!userWeeklyLiquidityPoints[account]) {
    userWeeklyLiquidityPoints[account] = {};
  }
  if (!userPoints[account]) {
    userPoints[account] = 0;
  }
  if (!userWeeklyPointsBreakdown[account]) {
    userWeeklyPointsBreakdown[account] = {};
  }
  if (!userWeeklyPointsBreakdown[account][weekLabel]) {
    userWeeklyPointsBreakdown[account][weekLabel] = {
      swapPoints: 0,
      liquidityPoints: 0
    };
  }
  if (!userWeeklyLiquidityPoints[account][weekLabel]) {
    userWeeklyLiquidityPoints[account][weekLabel] = 0;
  }

  const usedSoFar = userWeeklyLiquidityPoints[account][weekLabel];
  const remain = MAX_WEEKLY_LIQ_POINTS - usedSoFar;
  const actualAdd = Math.min(pointsToAdd, remain);

  if (actualAdd > 0) {
    userWeeklyLiquidityPoints[account][weekLabel] += actualAdd;
    userPoints[account] += actualAdd;
    userWeeklyPointsBreakdown[account][weekLabel].liquidityPoints += actualAdd;
  }
}

// ---------------------- “10k 单元”核心逻辑 ----------------------

/**
 * 将用户当前 leftoverMap[account] + (本次 amount) 合并 => 拆成若干 10k 单元 => 剩余 leftover
 */
function addUnitsToUser(owner, timestampSec, amount) {
  // 1) 先合并 leftover
  if (!userLeftoverMap[owner]) {
    userLeftoverMap[owner] = 0;
  }
  let combined = userLeftoverMap[owner] + amount;

  // 2) 计算能拆出多少个 10k
  const fullCount = Math.floor(combined / THRESHOLD);
  const leftover = combined % THRESHOLD;

  // 3) 对于每个 10k 单元，都创建记录
  for (let i = 0; i < fullCount; i++) {
    unitList.push({
      unitId: nextUnitId++,
      owner,
      startTime: timestampSec,
      isActive: true,
      claimedCycles: 0
    });
  }

  // 4) 更新 leftoverMap
  userLeftoverMap[owner] = leftover;
}

function removeUnitsFromUser(owner, amount) {
  // 确保有初始 leftover
  if (!userLeftoverMap[owner]) {
    userLeftoverMap[owner] = 0;
  }

  let leftover = userLeftoverMap[owner];

  // 1) 先尝试用 leftover 抵扣
  if (leftover >= amount) {
    // leftover 足够直接扣，扣减后退出
    userLeftoverMap[owner] = leftover - amount;
    return;
  } else {
    // leftover 不足，则先用 leftover 抵一部分
    amount -= leftover;
    leftover = 0; // leftover 用光
  }

  // 2) 用整份 (10k) 的方式回收
  //    需要回收多少份？
  //    为了覆盖 amount，需要向上取整
  const fullCount = Math.ceil(amount / THRESHOLD);

  // 开始回收单元
  let toRemove = fullCount;
  let removedCount = 0;

  for (let unit of unitList) {
    if (toRemove <= 0) break;
    if (!unit.isActive) continue;
    if (unit.owner !== owner) continue;

    unit.isActive = false;
    toRemove--;
    removedCount++;
  }

  // 当实际回收的数量 * 10k 大于等于 amount 时，说明“拆多了”
  // 多拆出来的部分要成为新的 leftover
  const totalRemoved = removedCount * THRESHOLD;
  if (totalRemoved >= amount) {
    // 剩余部分变成 leftover
    leftover += totalRemoved - amount;
  } else {
    // totalRemoved < amount 说明用户单元不够
    // 实际上无法满足移除 amount 的需求
    // 此时要不要报错，或者只允许部分移除，看业务要求
    // 下面示例：只移除掉能移除的部分，leftover 保持 0
    leftover += 0;
  }

  // 3) 更新 leftoverMap
  userLeftoverMap[owner] = leftover;
}

/**
 * 结算所有激活中的单元
 *   - 计算从 startTime -> END_TIMESTAMP 能装下几个 7 天周期
 *   - 对比 claimedCycles，如果有新增就发放积分(14 分)
 */
function settleAllUnits() {
  for (let unit of unitList) {
    if (!unit.isActive) {
      // 如果需要对“回收时间”之前的持有做部分结算，可在 removeUnitsFromUser 时记录一个 endTime
      continue;
    }
    const startSec = unit.startTime;
    const endSec = END_TIMESTAMP;
    const totalDuration = endSec - startSec;
    if (totalDuration <= 0) continue;

    const fullCycles = Math.floor(totalDuration / SEVEN_DAYS_SECONDS);
    if (fullCycles <= unit.claimedCycles) {
      continue;
    }

    // 有新的周期 => 发放
    for (let i = unit.claimedCycles + 1; i <= fullCycles; i++) {
      let awardingTimeUnix = startSec + i * SEVEN_DAYS_SECONDS;
      if (awardingTimeUnix > endSec) {
        break;
      }

      // 若 awardingTimeUnix==endSec 且跨周 => 往前挪1秒
      const awardingWeek = getWeekLabel(toMomentUTC(awardingTimeUnix));
      const endWeek = getWeekLabel(toMomentUTC(endSec));
      if (awardingTimeUnix === endSec && awardingWeek !== endWeek) {
        awardingTimeUnix = endSec - 1;
      }

      // 每隔 7 天 => 14 分
      awardLiquidityPoints(unit.owner, awardingTimeUnix, LIQ_POINTS_PER_7D_PER_10K);
    }

    unit.claimedCycles = fullCycles;
  }
}

// ---------------------- 读取 & 处理交易 ----------------------
const allTx = transactionRecords.allTransactions || [];

/**
 * (1) 统计每日 SWAP (并初始化 userPoints)
 */
allTx.forEach((tx) => {
  const { account, type, timestamp, amount } = tx;
  const unixTS = Number(timestamp);
  if (unixTS > END_TIMESTAMP) return;

  if (!userPoints[account]) {
    userPoints[account] = 0;
  }
  if (!userDailySwapVolumes[account]) {
    userDailySwapVolumes[account] = {};
  }

  if (type === "SWAP") {
    const dayStr = moment.utc(unixTS, "X").format("YYYY-MM-DD");
    if (!userDailySwapVolumes[account][dayStr]) {
      userDailySwapVolumes[account][dayStr] = 0;
    }
    userDailySwapVolumes[account][dayStr] += Number(amount);
  }
});

/**
 * (2) ADD/REMOVE_LIQUIDITY => 维护 10k 单元
 */
allTx
  .filter((tx) => {
    const t = tx.type;
    return t === "ADD_LIQUIDITY" || t === "REMOVE_LIQUIDITY";
  })
  .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
  .forEach((tx) => {
    const { account, type, timestamp, amount } = tx;
    const unixTS = Number(timestamp);
    if (unixTS > END_TIMESTAMP) return;

    if (type === "ADD_LIQUIDITY") {
      addUnitsToUser(account, unixTS, Number(amount));

      if (ENABLE_DEBUG && account === DEBUG_ADDRESS) {
        console.log(
          "ADD_LIQUIDITY   ",
          moment.unix(unixTS).utc().format("YYYY-MM-DD HH:mm:ss"),
          Number(amount),
          userLeftoverMap[account]
        );
      }
    } else if (type === "REMOVE_LIQUIDITY") {
      removeUnitsFromUser(account, Number(amount));

      if (ENABLE_DEBUG && account === DEBUG_ADDRESS) {
        console.log(
          "REMOVE_LIQUIDITY",
          moment.unix(unixTS).utc().format("YYYY-MM-DD HH:mm:ss"),
          Number(amount),
          userLeftoverMap[account]
        );
      }
    }
  });

/**
 * (3) 结算流动性 7天周期
 */
settleAllUnits();

/**
 * (4) 计算每日 SWAP 积分
 */
Object.keys(userDailySwapVolumes).forEach((account) => {
  const dailyMap = userDailySwapVolumes[account];

  if (ENABLE_DEBUG && account === DEBUG_ADDRESS) {
    Object.entries(dailyMap)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .forEach(([data, value]) => {
        console.log(
          "SWAP            ",
          `${data}         `,
          `${Math.min(MAX_SWAP_POINTS_PER_DAY, Math.floor(value / THRESHOLD))}   `,
          value
        );
      });
  }

  Object.keys(dailyMap).forEach((dayStr) => {
    const volume = dailyMap[dayStr];
    // 当天 SWAP 每满 10,000 => +1 分, 封顶 4 分
    const raw = Math.floor(volume / THRESHOLD);
    const swapPts = Math.min(raw, MAX_SWAP_POINTS_PER_DAY);

    if (swapPts > 0) {
      userPoints[account] += swapPts;

      // 记录到周统计
      const mDay = moment.utc(dayStr, "YYYY-MM-DD");
      const wLabel = getWeekLabel(mDay);
      if (!userWeeklyPointsBreakdown[account]) {
        userWeeklyPointsBreakdown[account] = {};
      }
      if (!userWeeklyPointsBreakdown[account][wLabel]) {
        userWeeklyPointsBreakdown[account][wLabel] = {
          swapPoints: 0,
          liquidityPoints: 0
        };
      }
      userWeeklyPointsBreakdown[account][wLabel].swapPoints += swapPts;
    }
  });
});

/**
 * 输出排行榜
 */
const totalRanking = Object.entries(userPoints)
  .filter(([_, val]) => val > 0)
  .map(([account, val]) => ({ account, totalPoints: val }))
  .sort((a, b) => b.totalPoints - a.totalPoints);

const lastWeekMoment = moment.utc(END_TIMESTAMP, "X");
const lastWeekLabel = getWeekLabel(lastWeekMoment);

const lastWeekArr = [];
const uniqueAccounts = [...new Set(allTx.map((tx) => tx.account))];
uniqueAccounts.forEach((account) => {
  const breakdown = userWeeklyPointsBreakdown[account]?.[lastWeekLabel];
  if (breakdown) {
    const sum = (breakdown.swapPoints || 0) + (breakdown.liquidityPoints || 0);
    if (sum > 0) {
      lastWeekArr.push({
        account,
        swapPts: breakdown.swapPoints,
        liqPts: breakdown.liquidityPoints,
        sumPts: sum
      });
    }
  }
});

lastWeekArr.sort((a, b) => b.sumPts - a.sumPts);

const sortedPointsArray = totalRanking.map((item) => {
  return {
    account: item.account,
    points: item.totalPoints
  };
});

const weeklySortedWeeklyPointsArray = lastWeekArr.map((item) => {
  return {
    account: item.account,
    points: item.sumPts
  };
});

// 如果需要写入文件：
function parseYearAndWeek(weekLabel) {
  const [yearStr, wStr] = weekLabel.split("-W");
  return {
    year: Number(yearStr),
    weekNumber: Number(wStr)
  };
}

function computeCustomWeekIndex(weekLabel, referenceWeekLabel, referenceWeekIndex) {
  const { year: refY, weekNumber: refW } = parseYearAndWeek(referenceWeekLabel);
  const refMoment = moment.utc().year(refY).isoWeek(refW).startOf("week");

  const { year, weekNumber } = parseYearAndWeek(weekLabel);
  const curMoment = moment.utc().year(year).isoWeek(weekNumber).startOf("week");

  return curMoment.diff(refMoment, "weeks") + referenceWeekIndex;
}

function transformBreakdownWithCustomWeeks(userWeeklyPointsBreakdown) {
  const referenceWeekLabel = "2025-W05";
  const referenceWeekIndex = 31;

  const result = {};

  for (const [account, weeklyMap] of Object.entries(userWeeklyPointsBreakdown)) {
    const arr = Object.entries(weeklyMap).map(([weekLabel, data]) => {
      const swapPts = data.swapPoints || 0;
      const liqPts = data.liquidityPoints || 0;
      return {
        originalWeek: weekLabel,
        weekIndex: computeCustomWeekIndex(weekLabel, referenceWeekLabel, referenceWeekIndex),
        swapPoints: swapPts,
        liquidityPoints: liqPts
      };
    });

    arr.sort((a, b) => a.weekIndex - b.weekIndex);

    // 计算累积和
    for (let i = 0; i < arr.length; i++) {
      const thisWeekPoints = arr[i].swapPoints + arr[i].liquidityPoints;
      if (i === 0) {
        arr[i].totalPoints = thisWeekPoints;
      } else {
        arr[i].totalPoints = thisWeekPoints + arr[i - 1].totalPoints;
      }
    }

    // 倒序(一般看最新周靠前)
    arr.reverse();

    result[account] = arr;
  }
  return result;
}

const customWeeklyData = transformBreakdownWithCustomWeeks(userWeeklyPointsBreakdown);

// ---------------------- 交易数据统计 ----------------------

const tradingStatistics = allTx.reduce(
  (acc, current) => {
    // 获取时间戳并转换为日期
    const timestamp = parseInt(current.timestamp) * 1000;
    const date = new Date(timestamp);

    // Swap 交易统计
    if (current.type === "SWAP") {
      // 总 Swap 交易统计
      acc.totalSwapVolume += parseFloat(current.amount);
      acc.totalSwapTransactions++;

      // 唯一交易账户统计
      if (!acc.uniqueTraders.includes(current.account)) {
        acc.uniqueTraders.push(current.account);
      }
    }

    // 2025年后的月度统计
    if (date.getFullYear() >= 2025) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      // 初始化月度统计
      if (!acc.monthlyStats[monthKey]) {
        acc.monthlyStats[monthKey] = {
          transactions: 0,
          volume: 0,
          uniqueTraders: 0,
          traders: new Set()
        };
      }

      // 月度交易统计
      acc.monthlyStats[monthKey].transactions++;
      acc.monthlyStats[monthKey].volume += parseFloat(current.amount);

      // 月度唯一交易者统计
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

// 最终处理
tradingStatistics.uniqueTraders = tradingStatistics.uniqueTraders.length;

// 处理月度统计（移除 traders 集合，只保留数量）
Object.keys(tradingStatistics.monthlyStats).forEach((month) => {
  delete tradingStatistics.monthlyStats[month].traders;
});

// ---------------------- 写入文件 ----------------------

fs.writeFileSync(
  path.join(__dirname, "../../src/data/pointsV3.ts"),
  `export const totalPoints = ${JSON.stringify(sortedPointsArray)};
  export const weeklyPoints = ${JSON.stringify(weeklySortedWeeklyPointsArray)};
  export const pointsLog: Record<string, any> = ${JSON.stringify(customWeeklyData)};
  export const tradingStatistics = ${JSON.stringify(tradingStatistics)}`
);

console.log("All Done!");
