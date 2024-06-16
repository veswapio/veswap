import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import BigNumber from "bignumber.js";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import ABI_ERC20 from "~/abis/erc20.json";

export default function useMyPairShare(account: any, pair: any) {
  const connex = useConnex();

  return useQuery({
    queryKey: ["my-pair-share", pair.token0.symbol, pair.token1.symbol],
    enabled: !!account,
    refetchInterval: 1000 * 20,
    queryFn: () => {
      const contract = connex.thor.account(pair.liquidityToken.address);
      return Promise.all([
        contract.method(find(ABI_ERC20, { name: "balanceOf" })).call(account),
        contract.method(find(ABI_ERC20, { name: "totalSupply" })).call(),
        contract.method(find(ABI_ERC20, { name: "allowance" })).call(account, ROUTER_ADDRESS)
      ]);
    },
    select: (data: any) => {
      const myLpBalance = BigNumber(data[0].decoded["0"]);
      const totalLpSupply = BigNumber(data[1].decoded["0"]);
      return {
        myLpBalance,
        totalLpSupply,
        percentage: myLpBalance.div(totalLpSupply),
        needApprove: data[2].decoded["0"] === "0"
      };
    }
  });
}
