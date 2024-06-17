// @ts-nocheck
import { getAddress } from "@ethersproject/address";
import sdk from "~/sdk";
import { useMemo } from "react";
// import { useSelector } from 'react-redux'
import { useAllTokens } from "./useToken";
import { isAddress } from "~/utils/helpers";
// import { AppState } from '../index'
// import { balanceKey } from './reducer'
import { DUMMY_VET } from "~/constants/config";
import { useConnex, useWallet } from "@vechain/dapp-kit-react";
import { useQuery } from "@tanstack/react-query";
import ERC20_ABI from "~/abis/erc20.json";
import { find } from "lodash";

/**
 * Returns a map of the given addresses to their eventually consistent ETH balances.
 */
export function useETHBalances(uncheckedAddresses: string[]): { [address: string]: sdk.JSBI | undefined } {
  const { account } = useWallet();
  const connex = useConnex();

  const addresses: string[] = useMemo(
    () => (uncheckedAddresses ? uncheckedAddresses.filter(isAddress).map(getAddress).sort() : []),
    [uncheckedAddresses]
  );

  const { data: accountData } = useQuery({
    queryKey: ["account"],
    queryFn: () => connex.thor.account(account).get()
  });

  return useMemo(() => {
    return addresses.reduce<{ [address: string]: sdk.JSBI }>((map, address) => {
      const value = accountData?.balance;
      if (value) {
        map[address] = sdk.JSBI.BigInt(value);
      }
      return map;
    }, {});
  }, [accountData?.balance, addresses]);
}

/**
 * Returns a map of token addresses to their eventually consistent token balances for a single account.
 */
export function useTokenBalances(
  address?: string,
  tokens?: (sdk.Token | undefined)[]
): { [tokenAddress: string]: sdk.TokenAmount | undefined } {
  const { account } = useWallet();
  const connex = useConnex();

  const validTokens: sdk.Token[] = useMemo(
    () => tokens?.filter((t?: sdk.Token): t is sdk.Token => isAddress(t?.address) !== false) ?? [],
    [tokens]
  );

  // TODO: check format
  const { data: tokensBalanceData } = useQuery({
    queryKey: ["tokenBalance", tokens],
    queryFn: () => {
      return Promise.all(
        tokens!.map(async (token) => {
          const contract = connex.thor.account(token?.address);
          const balanceData = await contract.method(find(ERC20_ABI, { name: "balanceOf" })).call(account!);
          return balanceData?.decoded?.[0];
        })
      );
    }
  });

  return useMemo(() => {
    if (!address || validTokens.length === 0) {
      return {};
    }
    return (
      validTokens.reduce<{ [address: string]: sdk.TokenAmount }>((map, token, i) => {
        if (tokensBalanceData) {
          map[token.address] = new sdk.TokenAmount(token, sdk.JSBI.BigInt(tokensBalanceData?.[i]));
        }
        return map;
      }, {}) ?? {}
    );
  }, [address, validTokens, tokensBalanceData]);
}

// contains the hacky logic to treat the WETH token input as if it's ETH to
// maintain compatibility until we handle them separately.
export function useTokenBalancesTreatWETHAsETH(
  address?: string,
  tokens?: (sdk.Token | undefined)[]
): { [tokenAddress: string]: sdk.TokenAmount | undefined } {
  const chainId = 1;
  const { tokensWithoutWETH, includesWETH } = useMemo(() => {
    if (!tokens || tokens.length === 0) {
      return { includesWETH: false, tokensWithoutWETH: [] };
    }
    let includesWETH = false;
    const tokensWithoutWETH = tokens.filter((t) => {
      const isWETH = t?.equals(DUMMY_VET[1]) ?? false;
      if (isWETH) includesWETH = true;
      return !isWETH;
    });
    return { includesWETH, tokensWithoutWETH };
  }, [tokens]);

  const balancesWithoutWETH = useTokenBalances(address, tokensWithoutWETH);
  const ETHBalance = useETHBalances(includesWETH ? [address!] : []);

  return useMemo(() => {
    if (includesWETH) {
      const weth = DUMMY_VET[chainId];
      const ethBalance = ETHBalance[address!];
      return {
        ...balancesWithoutWETH,
        ...(ethBalance && weth ? { [weth.address]: new sdk.TokenAmount(weth, ethBalance) } : null)
      };
    } else {
      return balancesWithoutWETH;
    }
  }, [balancesWithoutWETH, ETHBalance, includesWETH, address, chainId]);
}

// get the balance for a single token/account combo
export function useTokenBalance(account?: string, token?: sdk.Token): sdk.TokenAmount | undefined {
  return useTokenBalances(account, [token])?.[token?.address!];
}

// mimics the behavior of useAddressBalance
export function useTokenBalanceTreatingWETHasETH(account?: string, token?: sdk.Token): sdk.TokenAmount | undefined {
  const balances = useTokenBalancesTreatWETHAsETH(account, [token]);
  return token && token.address && balances?.[token.address];
}

// mimics useAllBalances
export function useAllTokenBalancesTreatingWETHasETH(): {
  [account: string]: { [tokenAddress: string]: sdk.TokenAmount | undefined };
} {
  const { account } = useWallet();
  const allTokens = useAllTokens();
  const allTokensArray = useMemo(() => Object.values(allTokens ?? {}), [allTokens]);
  const balances = useTokenBalancesTreatWETHAsETH(account!, allTokensArray);
  return account ? { [account]: balances } : {};
}
