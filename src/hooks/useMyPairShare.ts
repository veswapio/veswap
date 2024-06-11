import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import { fromWei } from "~/utils/helpers";
import ABI_ERC20 from "~/abis/erc20.json";

const ABI_BALANCE_OF = find(ABI_ERC20, { name: "balanceOf" });
const ABI_TOTAL_SUPPLY = find(ABI_ERC20, { name: "totalSupply" });

export default function useTokenBalanceList(account: any, pair: any) {
  const connex = useConnex();

  return useQuery({
    queryKey: ["my-pair-share", pair.token0.symbol, pair.token1.symbol],
    enabled: !!account,
    refetchInterval: 1000 * 60,
    queryFn: () => {
      return Promise.all([
        connex.thor.account(pair.liquidityToken.address).method(ABI_BALANCE_OF).call(account),
        connex.thor.account(pair.liquidityToken.address).method(ABI_TOTAL_SUPPLY).call()
      ]);
    },
    select: (data: any) => {
      console.log("select", data);
      const myLpBalance = fromWei(data[0].decoded["0"]);
      const totalLpSupply = fromWei(data[1].decoded["0"]);
      return myLpBalance / totalLpSupply;
    }
  });
}
