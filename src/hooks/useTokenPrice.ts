import { useQuery } from "@tanstack/react-query";

export default function useTokenPrice() {
  return useQuery({
    queryKey: ["token-price"],
    refetchInterval: 1000 * 60,
    queryFn: () => {
      return fetch(`https://api.coingecko.com/api/v3/simple/price?ids=vechain,vethor-token&vs_currencies=usd`)
        .then((res: any) => {
          return res.json();
        })
        .then((data: any) => {
          return {
            VET: data.vechain.usd,
            VVET: data.vechain.usd,
            VTHO: data["vethor-token"].usd
          };
        });
    }
  });
}
