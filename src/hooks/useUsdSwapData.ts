import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import BigNumber from "bignumber.js";
import ABI_ERC20 from "~/abis/erc20.json";

const SWAP_ADDRESS = "";

const tokens = [
  {
    symbol: "VeUSD",
    address: "",
    decimals: 18
  },
  {
    symbol: "USDGLO",
    address: "",
    decimals: 18
  }
];

export default function useUsdSwapData() {
  const connex = useConnex();
  const { account } = useWallet();

  return useQuery({
    queryKey: ["usd-swap-data"],
    enabled: !!account,
    refetchInterval: 1000 * 10,
    queryFn: () => {
      return Promise.all(
        tokens.map(async (token) => {
          const contract = connex.thor.account(token.address);
          const balanceData = await contract.method(find(ABI_ERC20, { name: "balanceOf" })).call(account);
          const allowanceData = await contract
            .method(find(ABI_ERC20, { name: "allowance" }))
            .call(account, SWAP_ADDRESS);

          return {
            symbol: token.symbol!,
            address: token.address,
            balance: balanceData.decoded.balance,
            allowance: BigNumber(allowanceData.decoded["0"])
          };
        })
      );
    },
    select: (data: { symbol: string; address: string; balance: string; allowance?: BigNumber }[]) => {
      return data.reduce(
        (a, c) => {
          const value = BigNumber(c.balance);
          const decimals = tokens.find((t) => t.symbol === c.symbol)!.decimals;
          a[c.symbol] = {
            rawBalance: value,
            displayBalance: value
              .div(10 ** decimals)
              .toFormat(6)
              .replace(/\.?0+$/, ""),
            address: c.address,
            allowance: c.allowance
          };
          return a;
        },
        {} as Record<
          string,
          {
            rawBalance: BigNumber;
            displayBalance: string;
            address: string;
            allowance?: BigNumber;
          }
        >
      );
    }
  });
}
