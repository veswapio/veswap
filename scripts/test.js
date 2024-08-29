import fs from "fs";

const result0 = JSON.parse(fs.readFileSync("./result-0.json", "utf-8"));
const result1 = JSON.parse(fs.readFileSync("./result-1.json", "utf-8"));
const result2 = JSON.parse(fs.readFileSync("./result-2.json", "utf-8"));
const result3 = JSON.parse(fs.readFileSync("./result-3.json", "utf-8"));

const totalArr = result0.concat(result1).concat(result2).concat(result3);

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
  .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))
  .map((item) => [item[0], parseInt(item[1])]);

fs.writeFileSync("../src/data/total-points.ts", `export const accumulatedData = ${JSON.stringify(sortedPointsArray)};`);
