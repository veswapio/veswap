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

// END_TIME (以 UTC 表示)，你可以根据需求自行设置
const END_TIMESTAMP = moment.utc(END_TIME).unix();

// ---------------------- 一些常量 & 数据结构 ----------------------
const ONE_DAY_SECONDS = 86400;
const SEVEN_DAYS_SECONDS = 7 * ONE_DAY_SECONDS;

/**
 * userPoints[account] = 全局总积分 (SWAP + 流动性)
 */
const userPoints = {};

/**
 * userWeeklyLiquidityPoints[account] = { [weekLabel]: number }
 *   - 用于记录“该周已增加多少 流动性积分”(防止超过 140)
 */
const userWeeklyLiquidityPoints = {};

/**
 * userWeeklyPointsBreakdown[account] = {
 *   [weekLabel]: {
 *     swapPoints: number,       // SWAP 收益
 *     liquidityPoints: number,  // 流动性收益(已计入用户总分)
 *   }
 * }
 *   - 用于展示每周具体积分明细
 */
const userWeeklyPointsBreakdown = {};

/**
 * userDailySwapVolumes[account] = {
 *   "YYYY-MM-DD": number (当天 swap 总量)
 * }
 */
const userDailySwapVolumes = {};

/**
 * segments[account] = [
 *   { start: number, end: number, amount: number },
 *   ...
 * ]
 *   代表该账号在 [start, end) 区间内，资金持有量恒为 amount
 */
const segments = {};

// ---------------------- 帮助函数 ----------------------

/**
 * 把 unix 秒 => moment 对象 (UTC0)
 */
function toMomentUTC(unixSec) {
  return moment.utc(unixSec, "X");
}

/**
 * 获取"年-周次"字符串，dow=1 => 周一~周日
 * e.g. 2025-W03
 */
function getWeekLabel(m) {
  // 确保是 UTC
  const mUtc = m.clone().utc();
  const year = mUtc.year();
  const w = mUtc.week();
  return `${year}-W${String(w).padStart(2, "0")}`;
}

/**
 * 发放流动性积分(受“每周 140 分”封顶)，并记录到 userWeeklyPointsBreakdown
 *   - awardingTimeUnix：发放时刻(UTC 秒)
 *   - pointsToAdd：本次想发放的积分量
 */
function awardLiquidityPoints(account, awardingTimeUnix, pointsToAdd) {
  const awardingMoment = toMomentUTC(awardingTimeUnix);
  const weekLabel = getWeekLabel(awardingMoment);

  // 初始化
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

  // 检查本周还可加多少分
  const usedSoFar = userWeeklyLiquidityPoints[account][weekLabel];
  const remain = 140 - usedSoFar;
  const actualAdd = Math.min(pointsToAdd, remain);

  if (actualAdd > 0) {
    userWeeklyLiquidityPoints[account][weekLabel] += actualAdd;
    userPoints[account] += actualAdd;
    userWeeklyPointsBreakdown[account][weekLabel].liquidityPoints += actualAdd;
  }
}

/**
 * 构造 segments：以 [start, end, amount] 表示资金持有区间
 *   - 只关心 ADD/REMOVE_LIQUIDITY
 *   - 不超过 END_TIME
 */
function buildSegmentsForUser(transactions, account) {
  const userTx = transactions.filter(
    (t) => t.account === account && (t.type === "ADD_LIQUIDITY" || t.type === "REMOVE_LIQUIDITY")
  );

  if (userTx.length === 0) {
    segments[account] = [];
    return;
  }

  // 按时间排序
  userTx.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  const segs = [];
  let currentAmount = 0;
  let prevTS = Number(userTx[0].timestamp);

  for (let i = 0; i < userTx.length; i++) {
    const tx = userTx[i];
    const txTime = Number(tx.timestamp);

    // 在 [prevTS, txTime) 这段区间内，amount = currentAmount
    if (currentAmount > 0 && prevTS < txTime) {
      const endBoundary = Math.min(txTime, END_TIMESTAMP);
      if (prevTS < END_TIMESTAMP) {
        segs.push({
          start: prevTS,
          end: endBoundary,
          amount: currentAmount
        });
      }
      if (txTime >= END_TIMESTAMP) {
        break;
      }
    }

    // apply ADD/REMOVE
    if (tx.type === "ADD_LIQUIDITY") {
      currentAmount += Number(tx.amount);
    } else if (tx.type === "REMOVE_LIQUIDITY") {
      currentAmount -= Number(tx.amount);
      if (currentAmount < 0) currentAmount = 0; // 防御
    }

    prevTS = txTime;
    if (prevTS >= END_TIMESTAMP) {
      break;
    }
  }

  // 末尾区段
  if (currentAmount > 0 && prevTS < END_TIMESTAMP) {
    segs.push({
      start: prevTS,
      end: END_TIMESTAMP,
      amount: currentAmount
    });
  }

  segments[account] = segs;
}

/**
 * 结算：对持有区间内，每满7天发一次积分 => 14 * floor(amount / 1000)
 * 关键改动：
 *   - 如果 awardingTimeUnix == segment.end (且该 end 落在最后一周)，
 *     则 awardingTimeUnix-- (往前挪1秒)，以确保它被记到此周的周日 23:59:59
 */
function settleSegmentsForUser(account) {
  const segs = segments[account] || [];
  segs.forEach((seg) => {
    const { start, end, amount } = seg;
    if (amount < 1000) return;

    // 7天周期发放：一次 = 14 * floor(amount/1000)
    const chunkPoints = 14 * Math.floor(amount / 1000);
    const durationSec = end - start;
    const fullCycles = Math.floor(durationSec / SEVEN_DAYS_SECONDS);

    for (let i = 1; i <= fullCycles; i++) {
      let awardingTimeUnix = start + i * SEVEN_DAYS_SECONDS;
      if (awardingTimeUnix > end) {
        break;
      }

      // 如果 awardingTimeUnix 正好等于 end，而且 end 落在最后一周，
      // 为了让它归属于这一周的周日 23:59:59，需要往前挪1秒
      // （以防它落到下一周的 周一 00:00:00）
      const awardingWeek = getWeekLabel(toMomentUTC(awardingTimeUnix));
      const endWeek = getWeekLabel(toMomentUTC(end));

      if (awardingTimeUnix === end && awardingWeek !== endWeek) {
        // 说明 awardingTimeUnix= end，但 endWeek 跟 awardingWeek 不同(表示下周了)
        awardingTimeUnix = end - 1; // 往前挪一秒
      }

      awardLiquidityPoints(account, awardingTimeUnix, chunkPoints);
    }
  });
}

// ---------------------- 读取 & 处理交易 ----------------------
const allTx = transactionRecords.allTransactions || [];

// 1) 统计每日 swap 量（注意在 END_TIME 之前）
allTx.forEach((tx) => {
  const { account, type, timestamp, amount } = tx;
  const unixTS = Number(timestamp);
  if (unixTS > END_TIMESTAMP) return; // 超过统计区间

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

// 2) 构造资金持有段
const uniqueAccounts = Array.from(new Set(allTx.map((t) => t.account)));
uniqueAccounts.forEach((account) => {
  buildSegmentsForUser(allTx, account);
});

// 3) 结算 7 天周期流动性积分
uniqueAccounts.forEach((account) => {
  settleSegmentsForUser(account);
});

// 4) 计算每日 SWAP 积分
uniqueAccounts.forEach((account) => {
  const dailyMap = userDailySwapVolumes[account] || {};
  Object.keys(dailyMap).forEach((dayStr) => {
    const volume = dailyMap[dayStr];
    // 当天 SWAP >=10000 => floor(volume/10000)，上限4
    const raw = Math.floor(volume / 10000);
    const swapPts = Math.min(raw, 4);

    if (swapPts > 0) {
      // 累加到总分
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

// ---------------------- 输出排行榜 ----------------------
/**
 * 1) 总分排行榜
 */
const totalRanking = Object.entries(userPoints)
  .filter(([_, val]) => val > 0)
  .map(([account, val]) => ({ account, totalPoints: val }))
  .sort((a, b) => b.totalPoints - a.totalPoints);

console.log("=== Total points ===");
totalRanking.forEach((item, idx) => {
  console.log(`Rank${idx + 1}: account=${item.account}, points=${item.totalPoints}`);
});

/**
 * 2) 最后一周排行榜
 *   - 找 END_TIME 所在周(UTC)
 */
const lastWeekMoment = moment.utc(END_TIMESTAMP, "X");
const lastWeekLabel = getWeekLabel(lastWeekMoment);

console.log(`\n=== Last week (${lastWeekLabel}) points ===`);

const lastWeekArr = [];
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
lastWeekArr.forEach((item, idx) => {
  console.log(
    `Rank${idx + 1}: account=${item.account}, swap=${item.swapPts}, liquidity=${item.liqPts}, sum=${item.sumPts}`
  );
});

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

console.log("Writing to the src/data/pointsV3.ts file...");

fs.writeFileSync(
  path.join(__dirname, "../../src/data/pointsV3.ts"),
  `export const totalPoints = ${JSON.stringify(sortedPointsArray)};
   export const weeklyPoints = ${JSON.stringify(weeklySortedWeeklyPointsArray)};`
);

console.log("All Done!");
