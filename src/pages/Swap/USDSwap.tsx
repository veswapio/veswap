import { clsx } from "clsx";
import { useAtom } from "jotai";
import { find } from "lodash";
import BigNumber from "bignumber.js";
import { useState, useMemo } from "react";
import { TextField, Input } from "react-aria-components";
import { useWallet, useWalletModal, useConnex } from "@vechain/dapp-kit-react";
import { transactionStatusAtom } from "~/store";
import useUsdBalance from "~/hooks/useUsdBalance";
import { VEUSD, VEUSD_ROUTER_ADDRESS } from "~/constants/usdTokens";
import TOKEN_ICONS from "~/constants/tokenIcons";
import ABI_ERC20 from "~/abis/erc20.json";
import ABI_USD_SWAP from "~/abis/TokenSwap.json";
import poll from "~/utils/poll";
import { queryClient } from "~/query";

import Card from "~/components/Card";
import Button from "~/components/Button";
import DataEntry from "~/components/DataEntry";
import css from "./Swap.module.scss";

import IconSwap from "~/assets/swap.svg?react";

function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  balance,
  displayBalance,
  error,
  disabled,
  hidePercentage,
  className
}: {
  label: string;
  token: string;
  amount: string;
  onAmountChange: (value: string) => void;
  balance?: BigNumber;
  displayBalance: string;
  error?: boolean;
  disabled?: boolean;
  hidePercentage?: boolean;
  className?: string;
}) {
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  const handlePercentageClick = (percentage: number) => {
    if (!balance) return;
    const value = balance
      .times(percentage)
      .div(10 ** VEUSD.decimals)
      .toString();
    onAmountChange(value);
  };

  const percentageList = [
    { name: "25%", value: 0.25 },
    { name: "50%", value: 0.5 },
    { name: "75%", value: 0.75 },
    { name: "Max", value: 1 }
  ];

  return (
    <div className={clsx("tokenInput", className)}>
      <div className="tokenInput__top">
        <h3 className="tokenInput__label">{label}</h3>
        <div className="tokenTrigger" style={{ pointerEvents: "none" }}>
          <div className="tokenTrigger__icon">{TOKEN_ICONS[token]}</div>
          <div className="tokenTrigger__name">{token}</div>
        </div>
      </div>
      <TextField aria-label={label + " token amount"} className={clsx("tokenInput__bottom", error && "error")}>
        <Input
          className="tokenInput__input"
          value={amount}
          onChange={handleInput}
          onBlur={() => (amount === "" || amount === ".") && onAmountChange("0")}
          onFocus={() => amount === "0" && onAmountChange("")}
          placeholder="0"
          disabled={disabled}
        />
        <div className="tokenInput__row">
          {!hidePercentage &&
            percentageList.map((item) => (
              <button key={item.value} className="tokenInput__button" onClick={() => handlePercentageClick(item.value)}>
                {item.name}
              </button>
            ))}
          <div className="tokenInput__balance">Balance: {displayBalance}</div>
        </div>
      </TextField>
    </div>
  );
}

export default function Swap() {
  const { open } = useWalletModal();
  const connex = useConnex();
  const { account } = useWallet();
  const { data: balanceData } = useUsdBalance();

  const [, setTransactionStatus] = useAtom(transactionStatusAtom);

  const [fromTokenAmount, setFromTokenAmount] = useState("0");
  const _fromTokenError = useMemo(() => {
    return BigNumber(fromTokenAmount)
      .times(10 ** VEUSD.decimals)
      .isGreaterThan(balanceData?.veusdBalance || 0);
  }, [fromTokenAmount, balanceData]);

  const handleSwap = () => {
    if (!connex) return;

    const amount = BigNumber(fromTokenAmount)
      .times(10 ** VEUSD.decimals)
      .toFixed();

    const approveMethod = connex.thor.account(VEUSD.address).method(find(ABI_ERC20, { name: "approve" }));
    const approveClause = approveMethod.asClause(VEUSD_ROUTER_ADDRESS, amount);

    const swapMethod = connex.thor
      .account(VEUSD_ROUTER_ADDRESS)
      .method(find(ABI_USD_SWAP.abi, { name: "swap", type: "function" }));
    const swapClause = swapMethod.asClause(amount);

    const clauses = [{ ...approveClause }, { ...swapClause }];

    setTransactionStatus({
      isPending: true,
      isSuccessful: false,
      isFailed: false,
      transactionHash: null,
      message: `Swap ${fromTokenAmount} VeUSD to ${fromTokenAmount} USDGLO`
    });

    connex.vendor
      .sign("tx", clauses)
      .comment(`Swap ${fromTokenAmount} VeUSD to ${fromTokenAmount} USDGLO`)
      .request()
      .then((tx: any) => {
        return poll(() => connex.thor.transaction(tx.txid).getReceipt());
      })
      .then((result: any) => {
        const isSuccess = result.reverted === false;
        setTransactionStatus({
          isPending: false,
          isSuccessful: isSuccess,
          isFailed: !isSuccess,
          transactionHash: result.meta.txID,
          message: null
        });
        if (isSuccess) {
          setFromTokenAmount("");
          queryClient.clear();
        }
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
        setTransactionStatus(undefined);
      });
  };

  return (
    <div className={css.swapPanel}>
      <Card className={css.card}>
        <TokenInput
          label="From"
          token="VeUSD"
          amount={fromTokenAmount}
          onAmountChange={setFromTokenAmount}
          balance={balanceData?.veusdBalance || BigNumber(0)}
          displayBalance={balanceData?.veusdDisplayBalance || "0"}
          error={_fromTokenError}
        />
        <span className={css.swapButton} tabIndex={-1} style={{ pointerEvents: "none" }}>
          <IconSwap />
        </span>
        <TokenInput
          label="To"
          token="USDGLO"
          amount={fromTokenAmount}
          onAmountChange={setFromTokenAmount}
          displayBalance={balanceData?.usdgloDisplayBalance || "0"}
          className={css.card__swapToPane}
          disabled
          hidePercentage
        />
        <DataEntry title="Price">1 VeUSD to 1 USDGLO</DataEntry>
        <DataEntry title="Route">VeUSD &gt; USDGLO</DataEntry>
        <DataEntry title="Swap Fees">0%</DataEntry>
      </Card>
      {account ? (
        <div className={css.verticalButtonGroup}>
          <Button
            onPress={handleSwap}
            disabled={_fromTokenError || BigNumber(fromTokenAmount).isNaN() || BigNumber(fromTokenAmount).eq(0)}
          >
            Swap
          </Button>
        </div>
      ) : (
        <Button onPress={open}>Connect Wallet</Button>
      )}
    </div>
  );
}
