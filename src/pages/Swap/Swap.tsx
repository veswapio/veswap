import { clsx } from "clsx";
import { useAtom } from "jotai";
import BigNumber from "bignumber.js";
import { useState, useMemo, useEffect } from "react";
import {
  Button as AriaButton,
  RadioGroup,
  Radio,
  Dialog,
  DialogTrigger,
  Modal,
  TextField,
  Input
} from "react-aria-components";
import { useWallet, useWalletModal, useConnex } from "@vechain/dapp-kit-react";
// import ABI_FACTORY from "~/abis/factory.json";

import sdk from "~/sdk";
import { queryClient } from "~/query";
import { transactionStatusAtom } from "~/store";
import tokens from "~/constants/tokens";
import TOKEN_ICONS from "~/constants/tokenIcons";
import { DEFAULT_DEADLINE_FROM_NOW } from "~/constants/config";
import useTokenBalanceList from "~/hooks/useTokenBalanceList";
import { formatBigNumber, fixedBigNumber, bigNumberToWei, Field } from "~/utils/helpers";
import { basisPointsToPercent, computeTradePriceBreakdown } from "~/utils/helpers";
import poll from "~/utils/poll";

import Card from "~/components/Card";
import Button from "~/components/Button";
import DataEntry from "~/components/DataEntry";
import SearchBox from "~/components/SearchBox";
import css from "./Swap.module.scss";

import IconArrow from "~/assets/arrow.svg?react";
import IconSwap from "~/assets/swap.svg?react";
import IconClose from "~/assets/close.svg?react";
import IconError from "~/assets/error.svg?react";

// import { useTokenAllowance } from "~/hooks/useTokenAllowance";
import { useSwapCallback } from "~/hooks/useSwapCallback";
// import { useApproveCallbackFromTrade } from "~/hooks/useApproveCallback";
import useDerivedSwapInfo from "~/hooks/useDerivedSwapInfo";
// import { useETHBalances } from "~/hooks/useBalances";

// let lockSwapFeeFetch = false;

// const getRoutePath = (trade: sdk.Trade | null) => {
//   if (!trade?.route?.path) return null;

//   return trade.route.path.map((item) => item.symbol).join("-");
// };

// we don't show fees for wrap/unwrap
// const swapFeePerRoute: { [route: string]: sdk.Percent } = {
//   "VET-VVET": new sdk.Percent(sdk.JSBI.BigInt(0)),
//   "VVET-VET": new sdk.Percent(sdk.JSBI.BigInt(0))
// };

function TokenModal({
  label,
  token,
  setToken,
  tokenList,
  disabled
}: {
  label: string;
  token: sdk.Token;
  setToken: (token: sdk.Token) => void;
  tokenList: sdk.Token[];
  disabled?: boolean;
}) {
  const { data: tokenBalanceMap } = useTokenBalanceList();
  const [searchKeyword, setSearchKeyword] = useState("");

  const _tokenList = useMemo(() => {
    if (!searchKeyword) return tokenList;
    return tokenList.filter(
      (i: any) =>
        i.symbol.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        i.address.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [tokenList, searchKeyword]);

  return (
    <DialogTrigger>
      <AriaButton className="tokenTrigger" isDisabled={!tokenBalanceMap || tokenList.length === 1 || disabled}>
        <div className="tokenTrigger__icon">{token.symbol && TOKEN_ICONS[token.symbol]}</div>
        <div className="tokenTrigger__name">{token.symbol}</div>
        {tokenList.length !== 1 && <IconArrow className="tokenTrigger__arrow" />}
      </AriaButton>
      <Modal className="ModalOverlay">
        <Dialog className="Modal">
          {({ close }) => (
            <>
              <h2 className="Modal__heading">
                Swap {label}
                <button
                  onClick={() => {
                    close();
                    setSearchKeyword("");
                  }}
                >
                  <IconClose className={css.close} />
                </button>
              </h2>
              <SearchBox
                className="Modal__search"
                placeholder="Search Token Name or Address"
                value={searchKeyword}
                onChange={setSearchKeyword}
              />
              <div className="Modal__content">
                {_tokenList.map((i) => (
                  <div
                    className={css.tokenEntry}
                    key={i.address}
                    onClick={() => {
                      close();
                      setToken(i);
                      setSearchKeyword("");
                    }}
                  >
                    <div className={css.tokenEntry__icon}>{i.symbol && TOKEN_ICONS[i.symbol]}</div>
                    <div className={css.tokenEntry__name}>
                      <strong>{i.symbol}</strong>
                      <span>{i.name}</span>
                    </div>
                    <div className={css.tokenEntry__balance}>{tokenBalanceMap![i.symbol!].displayBalance}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}

function TokenInput({
  label,
  token,
  amount,
  onAmountChange,
  onTokenChange,
  tokenList,
  error,
  className,
  disabled
}: {
  label: string;
  token: sdk.Token;
  amount: string;
  onAmountChange: (value: string) => void;
  onTokenChange: (token: sdk.Token) => void;
  tokenList: sdk.Token[];
  error?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const { data: tokenBalanceMap } = useTokenBalanceList();

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  const handlePercentageClick = (percentage: number) => {
    if (!tokenBalanceMap) return;
    const value = fixedBigNumber(tokenBalanceMap[token.symbol!].rawBalance.times(percentage).div(10 ** token.decimals));
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
        <TokenModal
          label={label.toLowerCase()}
          token={token}
          tokenList={tokenList}
          setToken={onTokenChange}
          disabled={disabled}
        />
      </div>
      <TextField aria-label={label + " token amount"} className={clsx("tokenInput__bottom", error && "error")}>
        <Input
          className="tokenInput__input"
          value={amount}
          onChange={handleInput}
          onBlur={() => (amount === "" || amount === ".") && onAmountChange("0")}
          onFocus={() => amount === "0" && onAmountChange("")}
          placeholder="0"
        />
        <div className="tokenInput__row">
          {percentageList.map((item) => (
            <button key={item.value} className="tokenInput__button" onClick={() => handlePercentageClick(item.value)}>
              {item.name}
            </button>
          ))}
          <div className="tokenInput__balance">
            Balance: {tokenBalanceMap ? tokenBalanceMap[token.symbol!].displayBalance : "0"}
          </div>
        </div>
      </TextField>
    </div>
  );
}

export default function Swap() {
  const { open } = useWalletModal();
  const { account } = useWallet();
  const { data: tokenBalanceMap } = useTokenBalanceList();
  const connex = useConnex();

  const [, setTransactionStatus] = useAtom(transactionStatusAtom);
  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromTokenAmount, setFromTokenAmount] = useState("0");
  const [toTokenAmount, setToTokenAmount] = useState("0");
  const [slippage, setSlippage] = useState("3");
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSlippageWarn, setShowSlippageWarn] = useState(false);
  const [isSlippageWarnShown, setIsSlippageWarnShown] = useState(false);
  const [pairData, setPairData] = useState<sdk.Pair | undefined>(undefined);
  const [isExactIn, setIsExactIn] = useState(true);
  const [deadline, _setDeadline] = useState<number>(DEFAULT_DEADLINE_FROM_NOW);

  const fromTokenList = useMemo(() => {
    if (toToken.symbol === "VET") return tokens.filter((i: any) => i.symbol !== "VET");
    if (toToken.symbol === "USDGLO") return tokens.filter((i: any) => i.symbol === "VET" || i.symbol === "B3TR");
    return tokens.filter((i: any) => i.symbol === "VET");
  }, [toToken.symbol]);

  const toTokenList = useMemo(() => {
    if (fromToken.symbol === "VET") return tokens.filter((i: any) => i.symbol !== "VET");
    if (fromToken.symbol === "USDGLO") return tokens.filter((i: any) => i.symbol === "VET" || i.symbol === "B3TR");
    return tokens.filter((i: any) => i.symbol === "VET");
  }, [fromToken.symbol]);

  const _fromReserve = useMemo(() => {
    if (!pairData) return BigNumber(0);
    const value = pairData.token0.symbol === fromToken.symbol ? pairData.reserve0 : pairData.reserve1;
    return BigNumber(value.raw.toString());
  }, [pairData, fromToken]);

  const _toReserve = useMemo(() => {
    if (!pairData) return BigNumber(0);
    const value = pairData.token1.symbol === toToken.symbol ? pairData.reserve1 : pairData.reserve0;
    return BigNumber(value.raw.toString());
  }, [pairData, toToken]);

  const _insufficient_liquidity = useMemo(() => {
    return BigNumber(toTokenAmount).isGreaterThan(fixedBigNumber(_toReserve.div(10 ** toToken.decimals)));
  }, [_toReserve, toTokenAmount, toToken]);

  const _price = useMemo(() => {
    if (!_fromReserve || !_toReserve) return BigNumber("0");
    return _fromReserve.div(_toReserve);
  }, [_fromReserve, _toReserve]);

  const _priceImpact = useMemo(() => {
    const k = _fromReserve.times(_toReserve);
    const newFromReserve = _fromReserve.plus(bigNumberToWei(fromTokenAmount, fromToken.decimals));
    const newToReserve = k.div(newFromReserve);
    const receive = _toReserve.minus(newToReserve);
    const _impact = receive.div(newToReserve);
    const impact = _impact.isNaN() ? BigNumber(0) : _impact.times(100);

    return {
      displayValue: fixedBigNumber(impact, 2),
      isDangerous: impact.isGreaterThanOrEqualTo(10)
    };
  }, [_fromReserve, _toReserve, fromTokenAmount, fromToken]);

  const _swapButtonText = useMemo(() => {
    if (_insufficient_liquidity) return "Insufficient Liquidity";
    if (_priceImpact.isDangerous) return "Price Impact Too High";
    return "Swap";
  }, [_priceImpact, _insufficient_liquidity]);

  const _fromTokenError = useMemo(() => {
    return BigNumber(fromTokenAmount).isGreaterThan(tokenBalanceMap?.[fromToken.symbol!].displayBalance!);
  }, [fromTokenAmount, fromToken, tokenBalanceMap]);

  const {
    bestTrade,
    tokenBalances: _tokenBalances,
    parsedAmounts: _parsedAmounts,
    tokens: _tokensDerived,
    error: _error
  } = useDerivedSwapInfo(
    isExactIn ? Field.INPUT : Field.OUTPUT,
    isExactIn ? fromTokenAmount : toTokenAmount,
    fromToken.address,
    toToken.address
  );

  const _amountIn = useMemo(() => {
    if (!bestTrade || isExactIn) return fromTokenAmount;
    return bestTrade.inputAmount.toSignificant(6);
  }, [bestTrade, isExactIn, fromTokenAmount]);

  const _amountOut = useMemo(() => {
    if (!bestTrade || !isExactIn) return toTokenAmount;
    return bestTrade.outputAmount.toSignificant(6);
  }, [bestTrade, isExactIn, toTokenAmount]);

  const allowedSlippage = useMemo(
    () => (!!customSlippage ? +customSlippage * 100 : +slippage * 100),
    [slippage, customSlippage]
  );
  const swapCallback = useSwapCallback(bestTrade!, allowedSlippage, deadline);
  // const myVetBalance = useETHBalances([account!])?.[account!];

  // TODO: Set Fee
  const [swapFee, _setSwapFee] = useState(basisPointsToPercent(100));
  // @ts-ignore
  const { priceImpactWithoutFee, realizedLPFee } = computeTradePriceBreakdown(bestTrade!, swapFee);

  const handleCustomSlippageWarnModalDisplay = () => {
    if (!isSlippageWarnShown) {
      setShowSlippageWarn(true);
      setIsSlippageWarnShown(true);
    }
  };

  const handleFromTokenChange = (value: string) => {
    if (!_fromReserve || !_toReserve) return;
    setFromTokenAmount(value);
    setIsExactIn(true);
  };

  const handleToTokenChange = (value: string) => {
    if (!_fromReserve || !_toReserve) return;
    setToTokenAmount(value);
    setIsExactIn(false);
  };

  const handleSwapTokens = () => {
    const _fromToken = fromToken;
    setFromToken(toToken);
    setToToken(_fromToken);

    if (isExactIn) {
      setToTokenAmount(fromTokenAmount);
    } else {
      setFromTokenAmount(toTokenAmount);
    }

    setIsExactIn(!isExactIn);
  };

  function onSwap() {
    setTransactionStatus({
      isPending: true,
      isSuccessful: false,
      isFailed: false,
      transactionHash: null,
      message: `Swap ${_amountIn} ${fromToken.symbol} for ${_amountOut} ${toToken.symbol}`
    });
    swapCallback?.()
      .then((hash) => {
        // TODO: Catch Hash here
        if (hash) {
          return poll(() => connex.thor.transaction(hash).getReceipt());
        } else {
          setTransactionStatus(undefined);
        }
      })
      .then((result: any) => {
        if (!result) return;

        const isSuccess = result.reverted === false;
        setTransactionStatus({
          isPending: false,
          isSuccessful: isSuccess,
          isFailed: !isSuccess,
          transactionHash: result.meta.txID,
          message: null
        });

        if (isSuccess) {
          setFromTokenAmount("0");
          setToTokenAmount("0");
          queryClient.refetchQueries({
            queryKey: ["token-balance-list"]
          });
        }
      })
      .catch((error: any) => {
        console.log(error);
      });
  }

  useEffect(() => {
    async function fetchData() {
      const tokenA = new sdk.Token(1, fromToken.address, fromToken.decimals, fromToken.symbol);
      const tokenB = new sdk.Token(1, toToken.address, toToken.decimals, toToken.symbol);
      const pairData = await sdk.Fetcher.fetchPairData(tokenA, tokenB, connex);
      setPairData(pairData);
    }
    fetchData();
  }, [fromToken, toToken, connex, setPairData]);

  // check whether the user has approved the router on the input token
  // const [approval, approveCallback] = useApproveCallbackFromTrade(bestTrade!, allowedSlippage);

  return (
    <div className={css.swapPanel}>
      {showSlippageWarn && (
        <div className="ModalOverlay">
          <div className="Modal">
            <>
              <IconError className="Modal__errorIcon" />
              <h2 className="Modal__heading center">Warning</h2>
            </>
            <p className="Modal__subheading">
              Custom slippage is not protected. Set a reasonable upper limit to avoid losses.
            </p>
            <Button small onPress={() => setShowSlippageWarn(false)}>
              Confirm
            </Button>
          </div>
        </div>
      )}

      <Card className={css.card}>
        <TokenInput
          label="From"
          token={fromToken}
          amount={_amountIn}
          onAmountChange={handleFromTokenChange}
          onTokenChange={(token: sdk.Token) => {
            setFromToken(token);
          }}
          tokenList={fromTokenList}
          error={_fromTokenError}
        />
        <button className={css.swapButton} onClick={handleSwapTokens} tabIndex={-1}>
          <IconSwap />
        </button>
        <TokenInput
          label="To"
          token={toToken}
          amount={_amountOut}
          onAmountChange={handleToTokenChange}
          onTokenChange={(token: sdk.Token) => {
            setToToken(token);
          }}
          tokenList={toTokenList}
          className={css.card__swapToPane}
        />

        <DataEntry
          title="Slippage"
          tooltip="Your transaction will be reverted if the price changes unfavorably by more than this percentage."
        >
          <div className={css.slippageGroup}>
            <RadioGroup
              orientation="horizontal"
              value={customSlippage || slippage}
              className={css.slippage}
              onChange={(v) => {
                setSlippage(v);
                setCustomSlippage("");
              }}
              aria-label="slippage"
            >
              <Radio className={css.slippage__option} value="1">
                1%
              </Radio>
              <Radio className={css.slippage__option} value="3">
                3%
              </Radio>
              <Radio className={css.slippage__option} value="5">
                5%
              </Radio>
            </RadioGroup>
            <label className={css.customSlippage}>
              <input
                type="text"
                className={css.customSlippage__input}
                value={customSlippage}
                onChange={(e) => setCustomSlippage(e.target.value)}
                onFocus={handleCustomSlippageWarnModalDisplay}
                placeholder="Custom"
              />
              <span className={css.customSlippage__unit}>%</span>
            </label>
          </div>
        </DataEntry>
        <DataEntry title="Price">
          {formatBigNumber(_price)} {fromToken.symbol} per {toToken.symbol}
        </DataEntry>
        <DataEntry title="Route">
          {/*bestTrade?.route.path.map(i => i.symbol).join(" > ")*/}
          {fromToken.symbol} &gt; {toToken.symbol}
        </DataEntry>
        <DataEntry
          title="Swap Fees"
          tooltip="Same as Uniswap-v2, distributed pro-rata to all in-range liquidity and the protocol at the time of the swap."
        >
          0.3%
        </DataEntry>
        <DataEntry
          title="Price Impact"
          tooltip="The price you get vs. the ideal price. Split the orders to make less impact to achieve better price."
        >
          <span className={_priceImpact.isDangerous ? css.red : undefined}>{_priceImpact.displayValue}%</span>
        </DataEntry>
      </Card>
      {account ? (
        <div className={css.verticalButtonGroup}>
          <Button
            onPress={onSwap}
            disabled={
              (isExactIn && (!fromTokenAmount || fromTokenAmount === "0")) ||
              (!isExactIn && (!toTokenAmount || toTokenAmount === "0")) ||
              _fromTokenError ||
              _insufficient_liquidity ||
              _priceImpact.isDangerous
            }
          >
            {_swapButtonText}
          </Button>
        </div>
      ) : (
        <Button onPress={open}>Connect Wallet</Button>
      )}
    </div>
  );
}
