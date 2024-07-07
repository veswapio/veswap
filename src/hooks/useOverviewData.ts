import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { BACKEND_URL } from "~/constants/link";

dayjs.extend(relativeTime);

const SWAP_PATH = '/subgraphs/name/swap/swap'

export function useSwapRecords() {
  return useQuery({
    queryKey: ["swap-records"],
    refetchInterval: 1000 * 60 * 3,
    queryFn: () => {
      return Promise.all([
        fetch(`${BACKEND_URL}${SWAP_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: `{
  swaps(first: 50, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
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
        }).then((res: any) => res.json())
      ]);
    },
    select: (data: any) => {
      return data[0].data.swaps.map((i: any) => {
        return {
          id: i.id,
          date: dayjs(i.timestamp * 1000).fromNow(),
          amountIn: i.amount0In === "0" ? i.amount1In : i.amount0In,
          amountOut: i.amount0Out === "0" ? i.amount1Out : i.amount0Out,
          fromToken:  i.amount0In !== "0" ? i.pair.token0 : i.pair.token1,
          toToken: i.amount0Out !== "0" ? i.pair.token0 : i.pair.token1,
        };
      });
    }
  });
}

export function useOverviewData() {
  return useQuery({
    queryKey: ["overview-data"],
    refetchInterval: 1000 * 60 * 10,
    queryFn: () => {
      return Promise.all([
        fetch(`${BACKEND_URL}${SWAP_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: `{
	pairs {
    token0 {
      symbol
    }
    volumeToken0,
    token1 {
      symbol
    }
    volumeToken1
  }
}`
          })
        }).then((res: any) => res.json())
      ]);
    },
    select: (data: any) => {
      return {
        totalVolume: data[0].data.pairs
          .filter((i: any) => i.token0.symbol !== "B3TR" && i.token1.symbol !== "B3TR")
          .map((i: any) => {
            return {
              token0: i.token0.symbol,
              volume0: BigNumber(i.volumeToken0),
              token1: i.token1.symbol,
              volume1: BigNumber(i.volumeToken1)
            };
          })
      };
    }
  });
}
