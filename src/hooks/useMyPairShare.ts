import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import BigNumber from "bignumber.js";
import ABI_ERC20 from "~/abis/erc20.json";

export default function useTokenBalanceList(account: any, pair: any) {
  const connex = useConnex();

  return useQuery({
    queryKey: ["my-pair-share", pair.token0.symbol, pair.token1.symbol],
    enabled: !!account,
    refetchInterval: 1000 * 60,
    queryFn: () => {
      return Promise.all([
        connex.thor
          .account(pair.liquidityToken.address)
          .method(find(ABI_ERC20, { name: "balanceOf" }))
          .call(account),
        connex.thor
          .account(pair.liquidityToken.address)
          .method(find(ABI_ERC20, { name: "totalSupply" }))
          .call()
      ]);
    },
    select: (data: any) => {
      const myLpBalance = BigNumber(data[0].decoded["0"]);
      const totalLpSupply = BigNumber(data[1].decoded["0"]);
      return myLpBalance.div(totalLpSupply);
    }
  });
}
