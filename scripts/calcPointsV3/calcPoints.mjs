import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import moment from "moment";
import { END_TIME } from "./config.js";
// import transactionRecords from "./_transaction-recordsTEST.json" with { type: "json" };
import transactionRecords from "./_transaction-recordsV3.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
/** 每 7 天、每 10000 元 => 14 分 */
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
  const fullCount = Math.floor(combined / 10000);
  const leftover = combined % 10000;

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
  // 用户想移除多少整份(10k)？
  const fullCount = Math.floor(amount / 10000);
  if (fullCount <= 0) return;

  // 逐个回收
  let toRemove = fullCount;

  for (let unit of unitList) {
    if (toRemove <= 0) break;
    if (!unit.isActive) continue;
    if (unit.owner !== owner) continue;

    // 回收
    unit.isActive = false;
    toRemove--;
  }

  // 如果还有余量(不够回收那么多份)，就放弃，因为 partial < 10k 不单独计份
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
// const allTx =
//   transactionRecords.allTransactions.filter((i) => i.account === "0xf9a1bc92e0eeee598b9fdb45397107b1f05f6cc1") || [];
// console.log("Account 0xf9a1bc92e0eeee598b9fdb45397107b1f05f6cc1");

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
      // console.log(
      //   "ADD_LIQUIDITY   ",
      //   moment.unix(unixTS).utc().format("YYYY-MM-DD HH:mm:ss"),
      //   Number(amount),
      //   userLeftoverMap[account]
      // );
    } else if (type === "REMOVE_LIQUIDITY") {
      removeUnitsFromUser(account, Number(amount));
      // console.log(
      //   "REMOVE_LIQUIDITY",
      //   moment.unix(unixTS).utc().format("YYYY-MM-DD HH:mm:ss"),
      //   Number(amount),
      //   userLeftoverMap[account]
      // );
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
  // console.log("SWAP\n", dailyMap);
  Object.keys(dailyMap).forEach((dayStr) => {
    const volume = dailyMap[dayStr];
    // 当天 SWAP 每满 10,000 => +1 分, 封顶 4 分
    const raw = Math.floor(volume / 10000);
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

fs.writeFileSync(
  path.join(__dirname, "../../src/data/pointsV3.ts"),
  `export const totalPoints = ${JSON.stringify(sortedPointsArray)};
  export const weeklyPoints = ${JSON.stringify(weeklySortedWeeklyPointsArray)};
  export const pointsLog: Record<string, any> = ${JSON.stringify(customWeeklyData)};`
);

console.log("All Done!");
