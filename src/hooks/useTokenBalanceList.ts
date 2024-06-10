import { useQuery } from "@tanstack/react-query";
import { useWallet, useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import { bigintToDecimalString } from "~/utils/helpers";
import tokens from "~/constants/tokens";
import ABI_ERC20 from "~/abis/erc20.json";

const ABI_BALANCE_OF = find(ABI_ERC20, { name: "balanceOf" });
const ABI_ALLOWANCE = find(ABI_ERC20, { name: "allowance" });

export default function useTokenBalanceList() {
  const connex = useConnex();
  const { account } = useWallet();

  return useQuery({
    queryKey: ["token-balance-list"],
    enabled: !!account,
    queryFn: () => {
      return Promise.all(
        tokens.map(async (token) => {
          // TODO: native token
          const isNativeToken = token.address === "0x45429a2255e7248e57fce99e7239aed3f84b7a53";
          const tokenContract = connex.thor.account(token.address);

          let balance;

          if (isNativeToken) {
            const accountData = await connex.thor.account(account).get();
            balance = BigInt(accountData.balance).toString();
          } else {
            const balanceData = await tokenContract.method(ABI_BALANCE_OF).call(account);
            balance = balanceData.decoded.balance;
          }

          const allowanceData = await connex.thor
            .account(token.address)
            .method(ABI_ALLOWANCE)
            .call(account, ROUTER_ADDRESS);

          return {
            balance,
            symbol: token.symbol!,
            allowance: allowanceData.decoded["0"]
          };
        })
      );
    },
    select: (data: { symbol: string; balance: string; allowance: string }[]) => {
      return data.reduce(
        (a, c) => {
          const value = BigInt(c.balance);
          a[c.symbol] = {
            rawBalance: value,
            displayBalance: bigintToDecimalString(value, tokens.find((t) => t.symbol === c.symbol)!.decimals),
            allowance: BigInt(c.allowance)
          };
          return a;
        },
        {} as Record<
          string,
          {
            rawBalance: bigint;
            displayBalance: string;
            allowance: bigint;
          }
        >
      );
    }
  });
}
