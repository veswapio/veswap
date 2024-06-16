import BigNumber from "bignumber.js";
import { getAddress } from '@ethersproject/address'
import sdk from "~/sdk"

export enum Field {
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT'
}

export enum QueryKeys {
  Allowances,
  Reserves,
  TotalSupply,
  V1PairAddress,
  TokenAddress
}

export function truncateAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBigNumber(bn: string | BigNumber, decimals = 6) {
  return BigNumber(bn)
    .toFormat(decimals)
    .replace(/\.?0+$/, "");
}

export function fixedBigNumber(bn: BigNumber, decimals = 6) {
  return bn.toFixed(decimals, 1).replace(/\.?0+$/, "");
}

export function bigNumberToWei(bn: string | BigNumber | undefined, decimals = 18) {
  return BigNumber(bn || "0")
    .times(10 ** decimals)
    .toFixed(0);
}

// returns the checksummed address if the address is valid, otherwise returns false
export function isAddress(value: any): string | false {
  try {
    return getAddress(value)
  } catch {
    return false
  }
}

// computes the minimum amount out and maximum amount in for a trade given a user specified allowed slippage in bips
export function computeSlippageAdjustedAmounts(
  trade: sdk.Trade,
  allowedSlippage: number
): { [field in Field]?: sdk.TokenAmount } {
  const pct = basisPointsToPercent(allowedSlippage)
  return {
    [Field.INPUT]: trade?.maximumAmountIn(pct),
    [Field.OUTPUT]: trade?.minimumAmountOut(pct)
  }
}

export function basisPointsToPercent(num: number): sdk.Percent {
  return new sdk.Percent(sdk.JSBI.BigInt(num), sdk.JSBI.BigInt(10000))
}