import { clsx } from "clsx";
import { useAtom } from "jotai";
import BigNumber from "bignumber.js";
import { useState, useMemo } from "react";
import { TextField, Input } from "react-aria-components";
import { useWallet, useWalletModal, useConnex } from "@vechain/dapp-kit-react";
// import ABI_FACTORY from "~/abis/factory.json";

import TOKEN_ICONS from "~/constants/tokenIcons";
import poll from "~/utils/poll";

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
  error,
  disabled,
  hidePercentage,
  className
}: {
  label: string;
  token: string;
  amount: string;
  onAmountChange: (value: string) => void;
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
    console.log("percentage", percentage);
    return;
    // if (!tokenBalanceMap) return;
    // const value = fixedBigNumber(tokenBalanceMap[token.symbol!].rawBalance.times(percentage).div(10 ** token.decimals));
    // onAmountChange(value);
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
        <div className="tokenTrigger">
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
          <div className="tokenInput__balance">Balance: 0</div>
        </div>
      </TextField>
    </div>
  );
}

export default function Swap() {
  const { open } = useWalletModal();
  const { account } = useWallet();
  // const connex = useConnex();

  // const [, setTransactionStatus] = useAtom(transactionStatusAtom);
  const [fromTokenAmount, setFromTokenAmount] = useState("0");

  const _fromTokenError = useMemo(() => {
    return false;
  }, []);

  return (
    <div className={css.swapPanel}>
      <Card className={css.card}>
        <TokenInput
          label="From"
          token="VeUSD"
          amount={fromTokenAmount}
          onAmountChange={setFromTokenAmount}
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
          className={css.card__swapToPane}
          disabled
          hidePercentage
        />
        <DataEntry title="Price">1 VeUSD to 1 USDGLO</DataEntry>
        <DataEntry title="Route">VeUSD &gt; USDGLO</DataEntry>
        <DataEntry
          title="Swap Fees"
          tooltip="Same as Uniswap-v2, distributed pro-rata to all in-range liquidity and the protocol at the time of the swap."
        >
          0.1%
        </DataEntry>
      </Card>
      {account ? (
        <div className={css.verticalButtonGroup}>
          <Button onPress={undefined}>Swap</Button>
        </div>
      ) : (
        <Button onPress={open}>Connect Wallet</Button>
      )}
    </div>
  );
}
