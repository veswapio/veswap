import BigNumber from "bignumber.js";
import { useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import { useQuery } from "@tanstack/react-query";
import IUniswapV2Pair from "~/abis/IUniswapV2Pair.json";

const VET_B3TR_PAIR_ADDRESS = "0xc6de3b8e4a9bf4a6756e60f5cb6705cb7d3c1649";

export default function useTokenPrice() {
  const connex = useConnex();

  return useQuery({
    queryKey: ["token-price"],
    refetchInterval: 1000 * 60,
    queryFn: async () => {
      return Promise.all([
        connex.thor
          .account(VET_B3TR_PAIR_ADDRESS)
          .method(find(IUniswapV2Pair.abi, { name: "getReserves" }))
          .call(),
        fetch(`https://api.coingecko.com/api/v3/simple/price?ids=vechain,vethor-token&vs_currencies=usd`).then(
          (res: any) => res.json()
        )
      ]);
    },
    select: (data: any): Record<string, number> => {
      const b3trPrice = BigNumber(data[0].decoded.reserve0)
        .div(data[0].decoded.reserve1)
        .times(data[1].vechain.usd)
        .toNumber();
      return {
        VET: data[1].vechain.usd,
        VVET: data[1].vechain.usd,
        VTHO: data[1]["vethor-token"].usd,
        B3TR: b3trPrice
      };
    }
  });
}
