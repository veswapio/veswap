import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { BACKEND_URL } from "~/constants/link";

dayjs.extend(relativeTime);

const SWAP_PATH = "/subgraphs/name/swap/swap";

export function useOverviewData() {
  const oneDayAgoTimestamp = +((Date.now() - 24 * 60 * 60 * 1000) / 1000).toFixed();

  return useQuery({
    queryKey: ["overview-data"],
    refetchInterval: 1000 * 60 * 10,
    queryFn: async () => {
      return fetch(`${BACKEND_URL}${SWAP_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: `{
            pairList: pairs {
              token0 {
                symbol
              }
              volumeToken0,
              token1 {
                symbol
              }
              volumeToken1
            }
            swapList: swaps(first: 50, orderBy: timestamp, orderDirection: desc) {
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
              from
              to
            }
            todayVolumeList: swaps(where:{timestamp_gt: ${oneDayAgoTimestamp}}) {
              amount0In
              amount1In
              pair {
                token0 {
                  symbol
                }
                token1 {
                  symbol
                }
              }
            }
            swapAddresses: swaps(first: 1000, orderBy: timestamp, orderDirection: desc) {
              from
            }
          }`
        })
      }).then((res: any) => res.json());
    },
    select: (data: any) => {
      return {
        totalVolume: data.data.pairList.map((i: any) => {
          return {
            token0: i.token0.symbol,
            volume0: BigNumber(i.volumeToken0),
            token1: i.token1.symbol,
            volume1: BigNumber(i.volumeToken1)
          };
        }),
        swapList: data.data.swapList.map((i: any) => {
          return {
            id: i.id,
            date: dayjs(i.timestamp * 1000).fromNow(),
            amountIn: i.amount0In === "0" ? i.amount1In : i.amount0In,
            amountOut: i.amount0Out === "0" ? i.amount1Out : i.amount0Out,
            fromToken: i.amount0In !== "0" ? i.pair.token0 : i.pair.token1,
            toToken: i.amount0Out !== "0" ? i.pair.token0 : i.pair.token1,
            from: i.from,
            to: i.to
          };
        }),
        todayVolume: data.data.todayVolumeList.reduce((a: any, c: any) => {
          if (c.amount0In !== "0") {
            a[c.pair.token0.symbol] = BigNumber(a[c.pair.token0.symbol] || 0).plus(c.amount0In);
          } else {
            a[c.pair.token1.symbol] = BigNumber(a[c.pair.token0.symbol] || 0).plus(c.amount1In);
          }
          return a;
        }, {}),
        traders: [...new Set(data.data.swapAddresses.map((item: any) => item.from))].length
      };
    }
  });
}
