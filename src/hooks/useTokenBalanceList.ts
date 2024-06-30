import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import BigNumber from "bignumber.js";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import tokens from "~/constants/tokens";
import ABI_ERC20 from "~/abis/erc20.json";

export default function useTokenBalanceList() {
  const connex = useConnex();
  const { account } = useWallet();

  return useQuery({
    queryKey: ["token-balance-list"],
    enabled: !!account,
    refetchInterval: 1000 * 10,
    queryFn: () => {
      return Promise.all(
        tokens.map(async (token) => {
          if (token.symbol === "VET") {
            const accountData = await connex.thor.account(account).get();

            return {
              symbol: token.symbol!,
              address: token.address,
              balance: BigInt(accountData.balance).toString()
            };
          } else {
            const contract = connex.thor.account(token.address);
            const balanceData = await contract.method(find(ABI_ERC20, { name: "balanceOf" })).call(account);
            const allowanceData = await contract
              .method(find(ABI_ERC20, { name: "allowance" }))
              .call(account, ROUTER_ADDRESS);

            return {
              symbol: token.symbol!,
              address: token.address,
              balance: balanceData.decoded.balance,
              allowance: BigNumber(allowanceData.decoded["0"])
            };
          }
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
            displayBalance: value.div(10 ** decimals).toFormat(6),
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
