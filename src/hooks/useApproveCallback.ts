import sdk from "~/sdk";
import { find } from "lodash";
import { useCallback, useMemo } from "react";
import { DUMMY_VET, MaxUint256 } from "~/constants/config";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import { useTokenAllowance } from "~/hooks/useTokenAllowance";
import { Field, computeSlippageAdjustedAmounts } from "~/utils/helpers";
// import { useTransactionAdder, useHasPendingApproval } from '../state/transactions/hooks'
import ERC20_ABI from "~/abis/erc20.json";
import { useConnex, useWallet } from "@vechain/dapp-kit-react";

export enum Approval {
  UNKNOWN,
  NOT_APPROVED,
  PENDING,
  APPROVED
}

// returns a function to approve the amount required to execute a trade if necessary, otherwise null
export function useApproveCallback(
  amountToApprove: sdk.TokenAmount,
  addressToApprove: string
): [Approval, () => Promise<void>] {
  const { account } = useWallet();
  const connex = useConnex();

  const currentAllowance = useTokenAllowance(amountToApprove?.token, account, addressToApprove);
  // const pendingApproval = useHasPendingApproval(amountToApprove?.token?.address)

  // check the current approval status
  const approval = useMemo(() => {
    // we don't need to approve VET
    if (amountToApprove?.token?.equals(DUMMY_VET[amountToApprove?.token?.chainId])) return Approval.APPROVED;
    // we might not have enough data to know whether or not we need to approve
    if (!currentAllowance) return Approval.UNKNOWN;
    // amountToApprove will be defined if currentAllowance is
    return currentAllowance.lessThan(amountToApprove) ? Approval.NOT_APPROVED : Approval.APPROVED;
  }, [amountToApprove, currentAllowance]);

  // const addTransaction = useTransactionAdder()
  const abi = find(ERC20_ABI, { name: "approve" });

  const approve = useCallback(async (): Promise<void> => {
    if (approval !== Approval.NOT_APPROVED) {
      console.error("approve was called unnecessarily, this is likely an error.");
      return;
    }

    const method = connex.thor.account(amountToApprove?.token?.address).method(abi);

    const clause = method.asClause(addressToApprove, MaxUint256);

    return connex.vendor
      .sign("tx", [{ ...clause }])
      .comment(`Unlock ${amountToApprove?.token?.symbol}`)
      .request()
      .then((response: any) => {
        console.debug(response)
        // addTransaction(response, {
        //   summary: 'Unlock ' + amountToApprove?.token?.symbol,
        //   approvalOfToken: amountToApprove?.token?.address
        // })
      })
      .catch((error: any) => {
        console.debug("Failed to approve token", error);
      });
  }, [addressToApprove, amountToApprove, approval, abi, connex.thor, connex.vendor]);

  return [approval, approve];
}

// wraps useApproveCallback in the context of a swap
export function useApproveCallbackFromTrade(trade: sdk.Trade, allowedSlippage = 0) {
  const amountToApprove = useMemo(
    () => computeSlippageAdjustedAmounts(trade, allowedSlippage)[Field.INPUT],
    [trade, allowedSlippage]
  );
  return useApproveCallback(amountToApprove!, ROUTER_ADDRESS);
}
