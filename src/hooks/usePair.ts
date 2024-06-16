import { useMemo } from 'react'
import sdk, { Token } from '~/sdk'
import { find } from 'lodash'
import { abi as IVexchangeV2PairABI } from '~/abis/IUniswapV2Pair.json'
import { QueryKeys } from '~/utils/helpers'
import { useConnex } from '@vechain/dapp-kit-react'
import { useQuery } from "@tanstack/react-query";

// returns null on errors
export function useContract(address: string) {
  const connex = useConnex()
  const abi = find(IVexchangeV2PairABI, { name: 'getReserves' })

  return useMemo(() => {
    try {
      return connex.thor.account(address).method(abi)
    } catch {
      return null
    }
  }, [address, abi, connex.thor])
}

function getPair(tokenA: Token, tokenB: Token, connex: any): () => Promise<sdk.Pair | null> {
  return async (): Promise<sdk.Pair | null> => {
    try {
      return await sdk.Fetcher.fetchPairData(tokenA, tokenB, connex)
    } catch {
      return null
    }
  }
}

/*
 * if loading, return undefined
 * if no pair created yet, return null
 * if pair already created (even if 0 reserves), return pair
 */
export function usePair(tokenA?: Token, tokenB?: Token): undefined | sdk.Pair | null {
  const pairAddress = !!tokenA && !!tokenB && !tokenA.equals(tokenB) ? sdk.Pair.getAddress(tokenA, tokenB) : undefined
  const method = useContract(pairAddress!)
  const connex = useConnex()

  const shouldFetch = !!method

  const { data } = useQuery({
    queryKey: shouldFetch ? [pairAddress, 1, QueryKeys.Reserves] : [null],
    queryFn: getPair(tokenA!, tokenB!, connex)
  })

  // useKeepSWRDataLiveAsBlocksArrive(mutate)

  return data
}