import { useWallet } from "@vechain/dapp-kit-react";
import { unitsUtils } from "@vechain/sdk-core";
import useTokenBalanceList from "./useTokenBalanceList";
import { Field } from "~/utils/helpers";
import sdk from "~/sdk";
import { useTradeExactIn, useTradeExactOut } from "./useTrade";
import { useTokenBalancesTreatWETHAsETH } from "./useBalances";
import { useTokenByAddressAndAutomaticallyAdd } from "./useToken";

const VTHO = new sdk.Token(sdk.ChainId.MAINNET, "0x0000000000000000000000000000456E65726779", 18, "VTHO", "VeThor");

export function tryParseAmount(value?: string, token?: sdk.Token): sdk.TokenAmount | undefined {
  if (!value || !token) {
    return undefined;
  }
  try {
    const typedValueParsed = unitsUtils.parseUnits(value, token.decimals).toString();
    if (typedValueParsed !== "0") {
      return new sdk.TokenAmount(token, sdk.JSBI.BigInt(typedValueParsed));
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision
    // (or maybe exceed max uint?)
    console.debug(`Failed to parse input amount: "${value}"`, error);
  }
  // necessary for all paths to return a value
  return undefined;
}

export default function useDerivedSwapInfo(
  independentField: Field,
  typedValue: string,
  tokenInAddress: string,
  tokenOutAddress: string
) {
  const { account: to } = useWallet();
  const { data: tokenBalanceMap } = useTokenBalanceList();

  const tokenIn = useTokenByAddressAndAutomaticallyAdd(tokenInAddress)
  const tokenOut = useTokenByAddressAndAutomaticallyAdd(tokenOutAddress)

  const relevantTokenBalances = useTokenBalancesTreatWETHAsETH(to!, [tokenIn, tokenOut])

  const isExactIn: boolean = independentField === Field.INPUT

  const amount = tryParseAmount(typedValue, isExactIn ? tokenIn : tokenOut)

  const bestTradeExactIn = useTradeExactIn(isExactIn ? amount : undefined, tokenOut)
  const bestTradeExactOut = useTradeExactOut(tokenIn, !isExactIn ? amount : undefined)

  const bestTrade = isExactIn ? bestTradeExactIn : bestTradeExactOut

  const parsedAmounts = {
    [Field.INPUT]: isExactIn ? amount : bestTrade?.inputAmount,
    [Field.OUTPUT]: isExactIn ? bestTrade?.outputAmount : amount
  }

  const tokenBalances = {
    [Field.INPUT]: relevantTokenBalances?.[tokenIn?.address!],
    [Field.OUTPUT]: relevantTokenBalances?.[tokenOut?.address!]
  }

  const tokens = {
    [Field.INPUT]: tokenIn,
    [Field.OUTPUT]: tokenOut
  }

  let error: string | undefined
  if (!to) {
    error = 'Connect Wallet'
  }

  if (!parsedAmounts[Field.INPUT]) {
    error = error ?? 'Enter an amount'
  }

  if (!parsedAmounts[Field.OUTPUT]) {
    error = error ?? 'Enter an amount'
  }

  if (
    tokenBalances[Field.INPUT] &&
    parsedAmounts[Field.INPUT] &&
    tokenBalances[Field.INPUT].lessThan(parsedAmounts[Field.INPUT])
  ) {
    error = 'Insufficient ' + tokens[Field.INPUT]?.symbol + ' balance'
  }

  // if (vthoBalance[Object.keys(vthoBalance)[0]]?.equalTo(JSBI.BigInt(0))) {
  //   error = 'Insufficient VTHO'
  // }

  return {
    tokens,
    tokenBalances,
    parsedAmounts,
    bestTrade,
    error
  };
}
