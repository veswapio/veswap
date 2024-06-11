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
    refetchInterval: 1000 * 10,
    queryFn: () => {
      return Promise.all(
        tokens.map(async (token) => {
          if (token.symbol === "VET") {
            const accountData = await connex.thor.account(account).get();

            return {
              symbol: token.symbol!,
              address: token.address,
              balance: BigInt(accountData.balance).toString(),
              needApprove: false
            };
          } else {
            const contract = connex.thor.account(token.address);
            const balanceData = await contract.method(ABI_BALANCE_OF).call(account);
            const allowanceData = await contract.method(ABI_ALLOWANCE).call(account, ROUTER_ADDRESS);

            return {
              symbol: token.symbol!,
              address: token.address,
              balance: balanceData.decoded.balance,
              needApprove: allowanceData.decoded["0"] === 0
            };
          }
        })
      );
    },
    select: (data: { symbol: string; address: string; balance: string; needApprove: boolean }[]) => {
      return data.reduce(
        (a, c) => {
          const value = BigInt(c.balance);
          a[c.symbol] = {
            rawBalance: value,
            displayBalance: bigintToDecimalString(value, tokens.find((t) => t.symbol === c.symbol)!.decimals),
            needApprove: c.needApprove,
            address: c.address
          };
          return a;
        },
        {} as Record<
          string,
          {
            rawBalance: bigint;
            displayBalance: string;
            needApprove: boolean;
            address: string;
          }
        >
      );
    }
  });
}
