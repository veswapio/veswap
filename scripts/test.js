import fs from "fs";

const INIT_TIMESTAMP = new Date("2024-06-05 00:00:00").getTime();
const PERIOD = 12 * 60 * 60 * 1000;

const result0 = JSON.parse(fs.readFileSync("./result-0.json", "utf-8"));
const result1 = JSON.parse(fs.readFileSync("./result-1.json", "utf-8"));
const result2 = JSON.parse(fs.readFileSync("./result-2.json", "utf-8"));
const result3 = JSON.parse(fs.readFileSync("./result-3.json", "utf-8"));
const result4 = JSON.parse(fs.readFileSync("./result-4.json", "utf-8"));
const result5 = JSON.parse(fs.readFileSync("./result-5.json", "utf-8"));

const startTimestamp = new Date("2024-09-09 00:00:00").getTime();
const appId = "0x899de0d0f0b39e484c8835b2369194c4c102b230c813862db383d44a4efe14d3"; // Cleanify

// total data
const totalArr = result0.concat(result1).concat(result2).concat(result3).concat(result4).concat(result5);

let pointsArray = {};
let swapAccumulatedMap = {};
let liquidityAccumulatedMap = {};

for (let i = 0; i < totalArr.length; i++) {
  const swapMapKeys = Object.keys(totalArr[i].swapMap);
  const swapMapValues = Object.values(totalArr[i].swapMap);
  for (let j = 0; j < swapMapKeys.length; j++) {
    const swapVetAmount = swapMapValues[j] / 10 ** 18 / 50000;
    if (pointsArray[swapMapKeys[j]] === undefined) {
      swapAccumulatedMap[swapMapKeys[j]];
      pointsArray[swapMapKeys[j]] = swapVetAmount;
    } else {
      pointsArray[swapMapKeys[j]] = pointsArray[swapMapKeys[j]] + swapVetAmount;
    }
  }
}

for (let i = 0; i < totalArr.length; i++) {
  const liquidityMapKeys = Object.keys(totalArr[i].liquidityMap);
  const liquidityMapValues = Object.values(totalArr[i].liquidityMap);

  for (let k = 0; k < liquidityMapKeys.length; k++) {
    const liquidityVetAmount = liquidityMapValues[k] / 10 ** 18 / 1000;

    if (liquidityAccumulatedMap[liquidityMapKeys[k]] === undefined) {
      liquidityAccumulatedMap[liquidityMapKeys[k]] = liquidityVetAmount;
      pointsArray[liquidityMapKeys[k]] = parseInt(liquidityVetAmount);
    } else {
      liquidityAccumulatedMap[liquidityMapKeys[k]] = liquidityAccumulatedMap[liquidityMapKeys[k]] + liquidityVetAmount;
      pointsArray[liquidityMapKeys[k]] =
        pointsArray[liquidityMapKeys[k]] + parseInt(liquidityAccumulatedMap[liquidityMapKeys[k]]);
    }
  }
}

const sortedPointsArray = Object.entries(pointsArray)
  .filter((i) => parseInt(i[1]) > 0)
  .map((item) => [item[0], parseInt(item[1])])
  .sort((a, b) => b[1] - a[1]);

// weekly data
const startIndex = Math.floor((startTimestamp - INIT_TIMESTAMP) / PERIOD);
const endIndex = startIndex + 2 * 7;
const weeklyArr = result5.filter((item) => item.index >= startIndex && item.index < endIndex);

let weeklyPointsArray = {};
let weeklySwapAccumulatedMap = {};
let weeklyLiquidityAccumulatedMap = {};

function calcRound() {
  const startTime = 1719792000; // Mon Jul 01 2024 00:00:00 GMT+0000
  const currentTime = Math.floor(Date.now() / 1000);
  const interval = 60 * 60 * 24 * 7; // 1 week
  return Math.ceil((currentTime - startTime) / interval) - 1;
}

const round = calcRound();

const voteParticipants = await fetch(`https://graph.vet/subgraphs/name/vebetter/dao`, {
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
            first: 1000
            where: {app: "${appId}"}
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
  .then((data) => {
    // console.log(data);
    const { participants } = data.data.round.apps.find((i) => !!i.participants.length);
    return participants.map((i) => i.id.split("/")[0]);
  });

for (let i = 0; i < weeklyArr.length; i++) {
  const swapMapKeys = Object.keys(weeklyArr[i].swapMap);
  const swapMapValues = Object.values(weeklyArr[i].swapMap);
  for (let j = 0; j < swapMapKeys.length; j++) {
    const swapVetAmount = swapMapValues[j] / 10 ** 18 / 50000;
    if (weeklyPointsArray[swapMapKeys[j]] === undefined) {
      weeklySwapAccumulatedMap[swapMapKeys[j]];
      weeklyPointsArray[swapMapKeys[j]] = swapVetAmount;
    } else {
      weeklyPointsArray[swapMapKeys[j]] = weeklyPointsArray[swapMapKeys[j]] + swapVetAmount;
    }
  }
}

for (let i = 0; i < weeklyArr.length; i++) {
  const liquidityMapKeys = Object.keys(weeklyArr[i].liquidityMap);
  const liquidityMapValues = Object.values(weeklyArr[i].liquidityMap);

  for (let k = 0; k < liquidityMapKeys.length; k++) {
    const liquidityVetAmount = liquidityMapValues[k] / 10 ** 18 / 1000;

    if (liquidityAccumulatedMap[liquidityMapKeys[k]] === undefined) {
      weeklyLiquidityAccumulatedMap[liquidityMapKeys[k]] = liquidityVetAmount;
      weeklyPointsArray[liquidityMapKeys[k]] = parseInt(liquidityVetAmount);
    } else {
      weeklyLiquidityAccumulatedMap[liquidityMapKeys[k]] =
        liquidityAccumulatedMap[liquidityMapKeys[k]] + liquidityVetAmount;
      weeklyPointsArray[liquidityMapKeys[k]] =
        weeklyPointsArray[liquidityMapKeys[k]] + parseInt(liquidityAccumulatedMap[liquidityMapKeys[k]]);
    }
  }
}

const weeklySortedweeklyPointsArray = Object.entries(weeklyPointsArray)
  .filter((i) => parseInt(i[1]) > 0)
  .map((item) => {
    const account = item[0];
    if (voteParticipants.includes(account)) {
      return [account, parseInt(item[1]) * 2, true];
    }
    return [account, parseInt(item[1])];
  })
  .sort((a, b) => {
    if (b[1] === a[1]) {
      if (b[2] === true && a[2] !== true) {
        return 1;
      } else if (a[2] === true && b[2] !== true) {
        return -1;
      }
    }
    return b[1] - a[1];
  });

fs.writeFileSync(
  "../src/data/points.ts",
  `export const totalPoints = ${JSON.stringify(sortedPointsArray)};
export const weeklyPoints = ${JSON.stringify(weeklySortedweeklyPointsArray)};`
);
