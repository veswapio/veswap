import { useMemo } from "react";
import sdk from "~/sdk";
import { usePair } from "./usePair";
import { DUMMY_VET, WVET } from "~/constants/config";

const VTHO = new sdk.Token(sdk.ChainId.MAINNET, "0x0000000000000000000000000000456E65726779", 18, "VTHO", "VeThor");

function useAllCommonPairs(tokenA?: sdk.Token, tokenB?: sdk.Token): sdk.Pair[] {
  const chainId = 1;

  // check for direct pair between tokens
  const pairBetween = usePair(tokenA, tokenB);

  // get token<->WVET pairs
  const aToWVET = usePair(tokenA, WVET[chainId]);
  const bToWVET = usePair(tokenB, WVET[chainId]);

  // get token<->VTHO pairs
  const aToVTHO = usePair(tokenA, chainId === sdk.ChainId.MAINNET ? VTHO : undefined);
  const bToVTHO = usePair(tokenB, chainId === sdk.ChainId.MAINNET ? VTHO : undefined);

  // get connecting pairs
  const VTHOToWVET = usePair(chainId === sdk.ChainId.MAINNET ? VTHO : undefined, WVET[chainId]);

  // only pass along valid pairs, non-duplicated pairs
  // @ts-ignore
  return useMemo(
    () =>
      [pairBetween, aToWVET, bToWVET, aToVTHO, bToVTHO, VTHOToWVET]
        // filter out invalid pairs
        .filter((p) => !!p)
        // filter out duplicated pairs
        .filter(
          (p, i, pairs) => i === pairs.findIndex((pair) => pair?.liquidityToken.address === p?.liquidityToken.address)
        ),
    [pairBetween, aToWVET, bToWVET, aToVTHO, bToVTHO, VTHOToWVET]
  );
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useTradeExactIn(amountIn?: sdk.TokenAmount, tokenOut?: sdk.Token): sdk.Trade | null {
  const inputToken = amountIn?.token;
  const outputToken = tokenOut;

  const tokenOutVet = tokenOut?.equals(DUMMY_VET[1]);
  const tokenInVet = inputToken?.equals(DUMMY_VET[1]);

  const tokenOutWvet = tokenOut?.equals(WVET[1]);
  const tokenInWvet = inputToken?.equals(WVET[1]);

  const allowedPairs = useAllCommonPairs(inputToken, outputToken);

  return useMemo(() => {
    if (amountIn && tokenOut && allowedPairs.length > 0) {
      if (tokenInVet && !tokenOutVet && !tokenOutWvet) {
        amountIn.token = WVET[1];
        const trade =
          sdk.Trade.bestTradeExactIn(allowedPairs, amountIn, tokenOut, {
            maxHops: 1,
            maxNumResults: 1
          })[0] ?? null;
        if (trade) {
          trade.inputAmount.token = DUMMY_VET[1];
          return trade;
        } else {
          return null;
        }
      } else if (!tokenInVet && !tokenInWvet && tokenOutVet) {
        const trade =
          sdk.Trade.bestTradeExactIn(allowedPairs, amountIn, WVET[1], {
            maxHops: 1,
            maxNumResults: 1
          })[0] ?? null;
        if (trade) {
          trade.outputAmount.token = DUMMY_VET[1];
          return trade;
        } else {
          return null;
        }
      } else if ((tokenInVet && tokenOutWvet) || (tokenInWvet && tokenOutVet)) {
        const amountOut = new sdk.TokenAmount(tokenOut, amountIn.raw);
        const route = new sdk.Route([new sdk.Pair(amountIn, amountOut)], inputToken);
        const trade = new sdk.Trade(route, amountIn, sdk.TradeType.EXACT_INPUT);
        trade.outputAmount = amountOut;
        return trade;
      } else {
        const trade = sdk.Trade.bestTradeExactIn(allowedPairs, amountIn, tokenOut, {
          maxHops: 2,
          maxNumResults: 1
        });

        return trade[0] ?? null;
      }
    }
    return null;
  }, [allowedPairs, amountIn, tokenOut, inputToken, tokenInVet, tokenInWvet, tokenOutVet, tokenOutWvet]);
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 */
export function useTradeExactOut(tokenIn?: sdk.Token, amountOut?: sdk.TokenAmount): sdk.Trade | null {
  const inputToken = tokenIn;
  const outputToken = amountOut?.token;

  const tokenOutVet = outputToken?.equals(DUMMY_VET[1]);
  const tokenInVet = inputToken?.equals(DUMMY_VET[1]);

  const tokenOutWvet = outputToken?.equals(WVET[1]);
  const tokenInWvet = inputToken?.equals(WVET[1]);

  const allowedPairs = useAllCommonPairs(inputToken, outputToken);

  return useMemo(() => {
    if (tokenIn && amountOut && allowedPairs.length > 0) {
      if (tokenOutVet && !tokenInVet && !tokenInWvet) {
        amountOut.token = WVET[1];
        const trade =
          sdk.Trade.bestTradeExactOut(allowedPairs, tokenIn, amountOut, {
            maxHops: 1,
            maxNumResults: 1
          })[0] ?? null;
        if (trade) {
          trade.outputAmount.token = DUMMY_VET[1];
          return trade;
        } else {
          return null;
        }
      } else if (tokenInVet && !tokenOutWvet && !tokenOutVet) {
        const trade =
          sdk.Trade.bestTradeExactOut(allowedPairs, WVET[1], amountOut, {
            maxHops: 1,
            maxNumResults: 1
          })[0] ?? null;
        if (trade) {
          trade.inputAmount.token = DUMMY_VET[1];
          return trade;
        } else {
          return null;
        }
      } else if ((tokenInVet && tokenOutWvet) || (tokenInWvet && tokenOutVet)) {
        const amountIn = new sdk.TokenAmount(inputToken, amountOut.raw);
        const route = new sdk.Route([new sdk.Pair(amountIn, amountOut)], inputToken);
        const trade = new sdk.Trade(route, amountIn, sdk.TradeType.EXACT_INPUT);
        trade.outputAmount = amountOut;
        return trade;
      } else {
        return (
          sdk.Trade.bestTradeExactOut(allowedPairs, tokenIn, amountOut, {
            maxHops: 1,
            maxNumResults: 1
          })[0] ?? null
        );
      }
    }
    return null;
  }, [allowedPairs, tokenIn, amountOut, inputToken, tokenInVet, tokenInWvet, tokenOutVet, tokenOutWvet]);
}
