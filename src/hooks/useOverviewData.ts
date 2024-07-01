import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useQuery } from "@tanstack/react-query";

dayjs.extend(relativeTime);

export function useSwapRecords() {
  return useQuery({
    queryKey: ["swap-records"],
    refetchInterval: 1000 * 60 * 3,
    queryFn: () => {
      return Promise.all([
        fetch("https://34.92.107.27:8000/subgraphs/name/swap/swap", {
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
          fromToken: i.pair.token0,
          toToken: i.pair.token1
        };
      });
    }
  });
}
