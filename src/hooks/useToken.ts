import sdk, { Token } from '~/sdk'
import { WVET } from '~/constants/config'
import { useMemo } from 'react'
import { findKey } from 'lodash'

import MAINNET_TOKENS from "~/constants/tokens"

export const ALL_TOKENS = [
  // WVET on all chains
  ...Object.values(WVET),
  // chain-specific tokens
  ...MAINNET_TOKENS
]
  // put into an object
  .reduce((tokenMap: any, token: any) => {
    if (tokenMap?.[token?.chainId]?.[token.address] !== undefined) throw Error('Duplicate tokens.')
    return {
      ...tokenMap,
      [token.chainId]: {
        ...tokenMap?.[token.chainId],
        [token.address]: token
      }
    }
  }, {})

export function useAllTokens(): { [address: string]: Token } {
  const chainId = 1

  return useMemo(() => {
    const userAddedTokens: sdk.Token[] = [];
    return (
      userAddedTokens
        .reduce<{ [address: string]: Token }>((tokenMap: any, token: any) => {
          tokenMap[token.address] = token
          return tokenMap
        }, ALL_TOKENS[chainId] ?? {})
    )
  }, [chainId])
}

export function useToken(tokenAddress: string): Token {
  const tokens = useAllTokens()

  return tokens?.[tokenAddress]
}

// gets token information by address (typically user input) and
// automatically adds it for the user if the token address is valid
export function useTokenByAddressAndAutomaticallyAdd(tokenAddress?: string): Token | undefined {
  const allTokens = useAllTokens()

  return useMemo(() => {
    const token = findKey(allTokens, token => token.address?.toLowerCase() === tokenAddress?.toLowerCase())
    return allTokens?.[token!]
  }, [allTokens, tokenAddress])
}