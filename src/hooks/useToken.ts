import sdk, { Token } from "~/sdk";
import { VVET } from "~/constants/config";
import { useMemo } from "react";
import { findKey } from "lodash";

// import MAINNET_TOKENS from "~/constants/tokens"

const MAINNET_TOKENS = [
  new sdk.Token(sdk.ChainId.MAINNET, "0x0000000000000000000000000000456E65726779", 18, "VTHO", "VeThor"),
  new sdk.Token(sdk.ChainId.MAINNET, "0x5ef79995FE8a89e0812330E4378eB2660ceDe699", 18, "B3TR", "B3TR"),
  new sdk.Token(sdk.ChainId.MAINNET, "0x170F4BA8e7ACF6510f55dB26047C83D13498AF8A", 18, "WoV", "WorldOfV"),
  new sdk.Token(sdk.ChainId.MAINNET, "0x29c630cCe4DdB23900f5Fe66Ab55e488C15b9F5e", 18, "USDGLO", "Glo Dollar")
];

export const ALL_TOKENS = [
  // VVET on all chains
  ...Object.values(VVET),
  // chain-specific tokens
  ...MAINNET_TOKENS
]
  // put into an object
  .reduce((tokenMap: any, token: any) => {
    if (tokenMap?.[token?.chainId]?.[token.address] !== undefined) throw Error("Duplicate tokens.");
    return {
      ...tokenMap,
      [token.chainId]: {
        ...tokenMap?.[token.chainId],
        [token.address]: token
      }
    };
  }, {});

export function useAllTokens(): { [address: string]: Token } {
  const chainId = 1;

  return useMemo(() => {
    const userAddedTokens: sdk.Token[] = [];
    return userAddedTokens.reduce<{ [address: string]: Token }>((tokenMap: any, token: any) => {
      tokenMap[token.address] = token;
      return tokenMap;
    }, ALL_TOKENS[chainId] ?? {});
  }, [chainId]);
}

export function useToken(tokenAddress: string): Token {
  const tokens = useAllTokens();

  return tokens?.[tokenAddress];
}

// gets token information by address (typically user input) and
// automatically adds it for the user if the token address is valid
export function useTokenByAddressAndAutomaticallyAdd(tokenAddress?: string): Token | undefined {
  const allTokens = useAllTokens();

  return useMemo(() => {
    const token = findKey(allTokens, (token) => token.address?.toLowerCase() === tokenAddress?.toLowerCase());
    return allTokens?.[token!];
  }, [allTokens, tokenAddress]);
}
