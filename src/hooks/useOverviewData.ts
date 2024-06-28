import { useQuery } from "@tanstack/react-query";

export default function useOverviewData() {
  return useQuery({
    queryKey: ["overview-data"],
    refetchInterval: 1000 * 60 * 10,
    queryFn: () => {
      return Promise.all([
        fetch("http://34.92.107.27:8000/subgraphs/name/swap/swap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: `{
            transactions(
            first: 100
            orderBy: timestamp
            orderDirection: desc
            where: {or: [{mints_: {id_not: null}}, {burns_: {id_not: null}}]}
            ) {
    burns {
      id
      timestamp
      amount0
      amount1
      pair {
        token0 {
          symbol
        }
        token1 {
          symbol
        }
      }
    }
    mints {
      id
      timestamp
      pair {
        token0 {
          symbol
        }
        token1 {
          symbol
        }
      }
    }
  }
}`
          })
        }).then((res: any) => res.json())
      ]);
    },
    select: (data: any) => {
      return data[0].data.transactions;
    }
  });
}
