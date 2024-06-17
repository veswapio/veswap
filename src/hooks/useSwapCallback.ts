// @ts-nocheck
import { useMemo } from "react";
import { find } from "lodash";
import { abi as IUniswapV2RouterABI } from "~/abis/IUniswapV2Router02.json";
import { useTokenAllowance } from "~/hooks/useTokenAllowance";
import { isAddress, bigNumberToWei, Field, computeSlippageAdjustedAmounts } from "~/utils/helpers";
import { useConnex, useWallet } from "@vechain/dapp-kit-react";
import { DEFAULT_DEADLINE_FROM_NOW, DUMMY_VET, INITIAL_ALLOWED_SLIPPAGE, WVET } from "~/constants/config";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import sdk from "~/sdk";
// import { abi as WVETABI } from '../constants/abis/WVET.json'

enum SwapType {
  EXACT_TOKENS_FOR_TOKENS,
  EXACT_TOKENS_FOR_VET,
  EXACT_VET_FOR_TOKENS,
  TOKENS_FOR_EXACT_TOKENS,
  TOKENS_FOR_EXACT_VET,
  VET_FOR_EXACT_TOKENS,
  WRAP_VET,
  UNWRAP_WVET
}

function getSwapType(tokens: { [field in Field]?: sdk.Token }, isExactIn: boolean): SwapType {
  if (isExactIn) {
    if (tokens[Field.INPUT]?.equals(DUMMY_VET[1])) {
      if (tokens[Field.OUTPUT]?.equals(WVET[1])) {
        return SwapType.WRAP_VET;
      } else {
        return SwapType.EXACT_VET_FOR_TOKENS;
      }
    } else if (tokens[Field.OUTPUT]?.equals(DUMMY_VET[1])) {
      if (tokens[Field.INPUT]?.equals(WVET[1])) {
        return SwapType.UNWRAP_WVET;
      } else {
        return SwapType.EXACT_TOKENS_FOR_VET;
      }
    } else {
      return SwapType.EXACT_TOKENS_FOR_TOKENS;
    }
  } else {
    if (tokens[Field.INPUT]?.equals(DUMMY_VET[1])) {
      if (tokens[Field.OUTPUT]?.equals(WVET[1])) {
        return SwapType.WRAP_VET;
      } else {
        return SwapType.VET_FOR_EXACT_TOKENS;
      }
    } else if (tokens[Field.OUTPUT]?.equals(DUMMY_VET[1])) {
      if (tokens[Field.INPUT]?.equals(WVET[1])) {
        return SwapType.UNWRAP_WVET;
      } else {
        return SwapType.TOKENS_FOR_EXACT_VET;
      }
    } else {
      return SwapType.TOKENS_FOR_EXACT_TOKENS;
    }
  }
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback(
  trade?: sdk.Trade, // trade to execute, required
  allowedSlippage: number = INITIAL_ALLOWED_SLIPPAGE, // in bips, optional
  deadline: number = DEFAULT_DEADLINE_FROM_NOW, // in seconds from now, optional
  to?: string // recipient of output, optional
): null | (() => Promise<string>) {
  const chainId = 1;
  const { account } = useWallet();
  const connex = useConnex();
  const inputAllowance = useTokenAllowance(trade?.inputAmount?.token, account, ROUTER_ADDRESS);
  const recipient = to ? isAddress(to) : account;

  return useMemo(() => {
    if (!trade) return null;
    if (!recipient) return null;

    // will always be defined
    const slippageAdjustedAmounts = computeSlippageAdjustedAmounts(trade, allowedSlippage);

    const isUnwrap =
      trade.inputAmount.token.equals(WVET[chainId]) && trade.outputAmount.token.equals(DUMMY_VET[chainId]);

    // no allowance
    if (
      !trade.inputAmount.token.equals(DUMMY_VET[chainId]) &&
      (!inputAllowance || slippageAdjustedAmounts[Field.INPUT]?.greaterThan(inputAllowance)) &&
      !isUnwrap
    ) {
      return null;
    }

    return async function onSwap() {
      const path = trade.route.path.map((t: any) => t.address);

      const deadlineFromNow: number = Math.ceil(Date.now() / 1000) + deadline;

      const swapType = getSwapType(
        { [Field.INPUT]: trade.inputAmount.token, [Field.OUTPUT]: trade.outputAmount.token },
        trade.tradeType === sdk.TradeType.EXACT_INPUT
      );

      let args, value, abi;

      switch (swapType) {
        case SwapType.EXACT_TOKENS_FOR_TOKENS:
          abi = find(IUniswapV2RouterABI, { name: "swapExactTokensForTokens" });

          args = [
            slippageAdjustedAmounts[Field.INPUT]?.raw.toString(),
            slippageAdjustedAmounts[Field.OUTPUT]?.raw.toString(),
            path,
            recipient,
            deadlineFromNow
          ];
          value = null;
          break;
        case SwapType.TOKENS_FOR_EXACT_TOKENS:
          abi = find(IUniswapV2RouterABI, { name: "swapTokensForExactTokens" });

          args = [
            slippageAdjustedAmounts[Field.OUTPUT]?.raw.toString(),
            slippageAdjustedAmounts[Field.INPUT]?.raw.toString(),
            path,
            recipient,
            deadlineFromNow
          ];
          value = null;
          break;
        case SwapType.EXACT_VET_FOR_TOKENS:
          abi = find(IUniswapV2RouterABI, { name: "swapExactETHForTokens" });

          args = [slippageAdjustedAmounts[Field.OUTPUT]?.raw.toString(), path, recipient, deadlineFromNow];
          value = bigNumberToWei(slippageAdjustedAmounts[Field.INPUT]?.raw.toString() || "0");
          break;
        case SwapType.TOKENS_FOR_EXACT_VET:
          abi = find(IUniswapV2RouterABI, { name: "swapTokensForExactETH" });

          args = [
            slippageAdjustedAmounts[Field.OUTPUT]?.raw.toString(),
            slippageAdjustedAmounts[Field.INPUT]?.raw.toString(),
            path,
            recipient,
            deadlineFromNow
          ];
          value = null;
          break;
        case SwapType.EXACT_TOKENS_FOR_VET:
          abi = find(IUniswapV2RouterABI, { name: "swapExactTokensForETH" });

          args = [
            slippageAdjustedAmounts[Field.INPUT]?.raw.toString(),
            slippageAdjustedAmounts[Field.OUTPUT]?.raw.toString(),
            path,
            recipient,
            deadlineFromNow
          ];
          value = null;
          break;
        case SwapType.VET_FOR_EXACT_TOKENS:
          abi = find(IUniswapV2RouterABI, { name: "swapETHForExactTokens" });

          args = [slippageAdjustedAmounts[Field.OUTPUT]?.raw.toString(), path, recipient, deadlineFromNow];
          value = bigNumberToWei(slippageAdjustedAmounts[Field.INPUT]?.raw.toString() || "0");
          break;
        // case SwapType.WRAP_VET:
        //   args = []
        //   abi = find(WVETABI, { name: 'deposit' })
        //   value = bigNumberToWei(slippageAdjustedAmounts[Field.INPUT].raw.toString())
        //   break
        // case SwapType.UNWRAP_WVET:
        //   args = [slippageAdjustedAmounts[Field.INPUT].raw.toString()]
        //   abi = find(WVETABI, { name: 'withdraw' })
        //   value = null
        //   break
      }

      const contractAddress =
        swapType === SwapType.UNWRAP_WVET || swapType === SwapType.WRAP_VET ? WVET[chainId].address : ROUTER_ADDRESS;
      let comment = `Swap ${trade.inputAmount.token.symbol} for ${trade.outputAmount.token.symbol}`;
      const method = connex.thor.account(contractAddress).method(abi);
      const clause = method.asClause.apply(args);

      if (swapType === SwapType.UNWRAP_WVET) {
        comment = "Unwrap WVET into VET";
      } else if (swapType === SwapType.WRAP_VET) {
        comment = "Wrap VET into WVET";
      }

      return connex.vendor
        .sign("tx", [
          {
            ...clause,
            value: value ? value.toString() : 0
          }
        ])
        .comment(comment)
        .request()
        .then((response: any) => {
          return response.txid;
        })
        .catch((error: any) => {
          console.error(`Swap or gas estimate failed`, error);
        });
    };
  }, [allowedSlippage, chainId, deadline, inputAllowance, trade, recipient, connex.vendor, connex.thor]);
}
