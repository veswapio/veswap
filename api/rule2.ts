import BigNumber from "bignumber.js";
import { sql } from "@vercel/postgres";
import { BACKEND_URL } from "~/constants/link";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SWAP_PATH = "/subgraphs/name/swap/swap";
const VET_B3TR_PAIR_ADDRESS = "0xc6de3b8e4a9bf4a6756e60f5cb6705cb7d3c1649";

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    const rawTokenPrice = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=vechain,vethor-token&vs_currencies=usd`
    ).then((res) => res.json());

    const tokenPrice: Record<string, number> = {
      VET: rawTokenPrice.vechain.usd,
      VVET: rawTokenPrice.vechain.usd,
      VTHO: rawTokenPrice["vethor-token"].usd
    };

    const { data } = await fetch(`${BACKEND_URL}${SWAP_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `{
          b3trPair: pair(id: "${VET_B3TR_PAIR_ADDRESS}") {
            reserve0
            reserve1
          }
          swaps {
            from
            to
            sender
            amount0In
            amount1In
            amount0Out
            amount1Out
            pair {
              token0 {
                symbol
              }
              token1 {
                symbol
              }
            }
          }
        }`
      })
    }).then((res) => res.json());

    const b3trPrice = BigNumber(data.b3trPair.reserve0).div(data.b3trPair.reserve1).times(tokenPrice.VET).toNumber();
    tokenPrice.B3TR = b3trPrice;

    const entryMap = data.swaps.reduce((a: Record<string, number>, c: any) => {
      let address;
      let swapValue;

      if (c.from === c.to) {
        address = c.from;
      } else if (c.to === c.sender) {
        address = c.from;
      }

      if (c.pair.token0.symbol === "VVET") {
        swapValue = BigNumber(c.amount0In === "0" ? c.amount0Out : c.amount0In).toFixed(8);
      } else if (c.pair.token1.symbol === "VVET") {
        swapValue = BigNumber(c.amount1In === "0" ? c.amount1Out : c.amount1In).toFixed(8);
      } else {
        if (c.amount0In !== "0") {
          swapValue = BigNumber(c.amount0In).times(tokenPrice[c.pair.token0.symbol]).div(tokenPrice.VET).toFixed(8);
        } else {
          swapValue = BigNumber(c.amount1In).times(tokenPrice[c.pair.token1.symbol]).div(tokenPrice.VET).toFixed(8);
        }
      }

      swapValue = Number(swapValue);

      if (a[address]) {
        a[address] += swapValue;
      } else {
        a[address] = swapValue;
      }

      return a;
    }, {});

    const entries = Object.entries(entryMap)
      .map(([address, swapValue]) => `('${address}', ${swapValue})`)
      .join(",");

    await sql.query(`
      INSERT INTO leaderboard (address, swap_value)
      VALUES ${entries}
      ON CONFLICT (address) DO UPDATE
      SET swap_value = leaderboard.swap_value + EXCLUDED.swap_value;`);

    response.status(200).json({ success: true });
  } catch (error) {
    response.status(500).json({ error });
  }
}
