import fs from "fs";
import { parse } from "csv-parse/sync";
import BigNumber from "bignumber.js";

// https://explore.vechain.org/accounts/0x3946ad2ca036489f5a90dbb4c72fb31aff98ef11/transfer
// from June 05 00:00 to July 29 24:00
const vetVthoTransactions = fs.readFileSync("./csv/vet-vtho-0.csv", "utf-8");

// https://explore.vechain.org/accounts/0xc6de3b8e4a9bf4a6756e60f5cb6705cb7d3c1649/transfer
// from June 05 00:00 to July 29 24:00
const vetB3trTransactions = fs.readFileSync("./csv/vet-b3tr-0.csv", "utf-8");

const START_TIMESTAMP = new Date("2024-06-05 00:00:00").getTime();
const PERIOD = 12 * 60 * 60 * 1000;

const ADD_LIQUIDITY_METHOD = "0xe8e33700";
const ADD_LIQUIDITY_ETH_METHOD = "0xf305d719";
const REMOVE_LIQUIDITY_METHOD = "0xbaa2abde";
const REMOVE_LIQUIDITY_ETH_METHOD = "0x02751cec";
const SWAP_ETH_FOR_EXACT_TOKENS = "0xfb3bdb41";
const SWAP_EXACT_ETH_FOR_TOKENS = "0x7ff36ab5";
const SWAP_EXACT_TOKENS_FOR_ETH = "0x18cbafe5";
const SWAP_EXACT_TOKENS_FOR_TOKENS = "0x38ed1739";
const SWAP_TOKENS_FOR_EXACT_ETH = "0x4a25d94a";
const SWAP_TOKENS_FOR_EXACT_TOKENS = "0x8803dbee";

const result = [];
const transactionGroups = {};
let groupIndex = 0;

function parseTransactions(file) {
  const seenTxids = new Set();
  const records = parse(file, { columns: true, skip_empty_lines: true });

  records.forEach((i) => {
    const txid = i.Txid;
    const transactionTimestamp = new Date(i["Date(GMT)"]).getTime();

    if (seenTxids.has(txid)) return;
    if (transactionTimestamp < START_TIMESTAMP) return;

    seenTxids.add(txid);
    groupIndex = Math.floor((transactionTimestamp - START_TIMESTAMP) / PERIOD);

    if (transactionGroups[groupIndex]) {
      transactionGroups[groupIndex].push(txid);
    } else {
      transactionGroups[groupIndex] = [txid];
    }
  });
}

async function fetchGroupData(txidList) {
  try {
    const list = await Promise.all(
      txidList.map((i) => fetch(`https://mainnet.vechain.org/transactions/${i}`).then((res) => res.json()))
    );

    const liquidityMap = {};
    const swapMap = {};

    for (const c of list) {
      const address = c.origin;
      const addLiquidityClause = c.clauses.find((j) => j.data.startsWith(ADD_LIQUIDITY_ETH_METHOD));
      // const removeLiquidityClause = c.clauses.find((j) => j.data.startsWith(REMOVE_LIQUIDITY_ETH_METHOD));
      const swapVetForTokensClause = c.clauses.find(
        (j) => j.data.startsWith(SWAP_ETH_FOR_EXACT_TOKENS) || j.data.startsWith(SWAP_EXACT_ETH_FOR_TOKENS)
      );
      const swapTokensForVetClause = c.clauses.find(
        (j) => j.data.startsWith(SWAP_EXACT_TOKENS_FOR_ETH) || j.data.startsWith(SWAP_TOKENS_FOR_EXACT_ETH)
      );
      const swapTokensForTokensClause = c.clauses.find(
        (j) => j.data.startsWith(SWAP_TOKENS_FOR_EXACT_TOKENS) || j.data.startsWith(SWAP_EXACT_TOKENS_FOR_TOKENS)
      );

      let addLiquidityAmount;
      let swapAmount;

      if (addLiquidityClause) {
        addLiquidityAmount = BigNumber(addLiquidityClause.value);
      } else if (swapVetForTokensClause) {
        swapAmount = BigNumber(swapVetForTokensClause.value);
      } else if (swapTokensForVetClause) {
        try {
          const receipt = await fetch(`https://mainnet.vechain.org/transactions/${c.id}/receipt`).then((res) =>
            res.json()
          );
          const output = receipt.outputs.find((j) => j.transfers.length > 0);
          swapAmount = BigNumber(output.transfers[0].amount);
        } catch (error) {
          console.log("--- Unable to get swap amount ---");
          console.log(c.id);
        }
      } else if (swapTokensForTokensClause) {
        // todo
      } else {
        continue;
      }

      if (addLiquidityAmount) {
        if (liquidityMap[address]) {
          liquidityMap[address] = BigNumber(liquidityMap[address]).plus(addLiquidityAmount);
        } else {
          liquidityMap[address] = addLiquidityAmount;
        }
      }

      if (swapAmount) {
        if (swapMap[address]) {
          swapMap[address] = BigNumber(swapMap[address]).plus(swapAmount);
        } else {
          swapMap[address] = swapAmount;
        }
      }
    }

    return { liquidityMap, swapMap };
  } catch (error) {
    console.error("Error fetching group data:", error);
    throw error;
  }
}

parseTransactions(vetVthoTransactions);
parseTransactions(vetB3trTransactions);

// console.log(await fetchGroupData(transactionGroups[groupIndex]));

for (let i = 0; i <= groupIndex; i++) {
  const group = transactionGroups[i];
  if (!group) continue;
  const groupResult = await fetchGroupData(group);
  result.push(groupResult);
  console.log("Processed group", i, "of", groupIndex, "groups.");
}

fs.writeFileSync("./result.json", JSON.stringify(result, null, 2));
console.log("Done!");
