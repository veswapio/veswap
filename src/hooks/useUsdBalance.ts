import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import BigNumber from "bignumber.js";
import { VEUSD, USDGLO, VEUSD_ROUTER_ADDRESS } from "~/constants/usdTokens";

import ABI_ERC20 from "~/abis/erc20.json";

export default function useUsdBalance() {
  const connex = useConnex();
  const { account } = useWallet();

  return useQuery({
    queryKey: ["token-balance-list", account],
    enabled: !!account,
    refetchInterval: 1000 * 10,
    queryFn: () => {
      const veusdContract = connex.thor.account(VEUSD.address);
      const usdgloContract = connex.thor.account(USDGLO.address);
      return Promise.all([
        veusdContract.method(find(ABI_ERC20, { name: "balanceOf" })).call(account),
        veusdContract.method(find(ABI_ERC20, { name: "allowance" })).call(account, VEUSD_ROUTER_ADDRESS),
        usdgloContract.method(find(ABI_ERC20, { name: "balanceOf" })).call(account),
        usdgloContract.method(find(ABI_ERC20, { name: "balanceOf" })).call(VEUSD_ROUTER_ADDRESS)
      ]);
    },
    select: (data) => {
      return {
        veusdBalance: BigNumber(data[0].decoded["0"]),
        veusdDisplayBalance: BigNumber(data[0].decoded["0"])
          .div(10 ** VEUSD.decimals)
          .toFormat(6)
          .replace(/\.?0+$/, ""),
        veusdAllowance: BigNumber(data[1].decoded["0"]),
        usdgloBalance: BigNumber(data[2].decoded["0"]),
        usdgloDisplayBalance: BigNumber(data[2].decoded["0"])
          .div(10 ** USDGLO.decimals)
          .toFormat(6)
          .replace(/\.?0+$/, ""),
        convertBalance: BigNumber(data[3].decoded["0"]),
        convertDisplayBalance: BigNumber(data[3].decoded["0"])
          .div(10 ** USDGLO.decimals)
          .toFormat(6)
          .replace(/\.?0+$/, "")
      };
    }
  });
}
