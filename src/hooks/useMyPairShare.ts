import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import ABI_ERC20 from "~/abis/erc20.json";

const ABI_BALANCE_OF = find(ABI_ERC20, { name: "balanceOf" });
const ABI_TOTAL_SUPPLY = find(ABI_ERC20, { name: "totalSupply" });

export default function useTokenBalanceList(account: any, pair: any) {
  const connex = useConnex();

  return useQuery({
    queryKey: ["my-pair-share", pair.token0.symbol, pair.token1.symbol],
    enabled: !!account,
    refetchInterval: 1000 * 180,
    queryFn: () => {
      return connex.thor.account(pair.liquidityToken.address).method(ABI_BALANCE_OF).call(account);
    }
  });
}
