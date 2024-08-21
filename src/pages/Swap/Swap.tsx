import { clsx } from "clsx";
import { find } from "lodash";
import { atom, useAtom } from "jotai";
import BigNumber from "bignumber.js";
import { useState, useMemo, useEffect } from "react";
import {
  Button as AriaButton,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  RadioGroup,
  Radio,
  Dialog,
  DialogTrigger,
  Modal,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  TextField,
  Input
} from "react-aria-components";
import { useWallet, useWalletModal, useConnex } from "@vechain/dapp-kit-react";
import IUniswapV2Router from "~/abis/IUniswapV2Router02.json";
import ABI_ERC20 from "~/abis/erc20.json";
import ABI_MerkleDistributor from "~/abis/MerkleDistributor.json";
// import ABI_FACTORY from "~/abis/factory.json";

import sdk from "~/sdk";
import tokens from "~/constants/tokens";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import { DEFAULT_DEADLINE_FROM_NOW } from "~/constants/config";
import useTokenBalanceList from "~/hooks/useTokenBalanceList";
import useFeaturedPairList from "~/hooks/useFeaturedPairList";
import useMyPairShare from "~/hooks/useMyPairShare";
import { truncateAddress, formatBigNumber, fixedBigNumber, bigNumberToWei, Field } from "~/utils/helpers";
import { queryClient } from "~/query";
import { basisPointsToPercent, computeTradePriceBreakdown } from "~/utils/helpers";
import TOKEN_ICONS from "~/constants/tokenIcons";

import Card from "~/components/Card";
import Button from "~/components/Button";
import DataEntry from "~/components/DataEntry";
// import Tooltip from "~/components/Tooltip";
import SearchBox from "~/components/SearchBox";
import css from "./Swap.module.scss";

import rewardTestData from "../../reward-data/round-result-test.json";
import rewardRonud1Data from "../../reward-data/round1-result.json";
import rewardRonud2Data from "../../reward-data/round2-result.json";

import IconArrow from "~/assets/arrow.svg?react";
import IconArrow2 from "~/assets/arrow2.svg?react";
import IconSwap from "~/assets/swap.svg?react";
import IconClose from "~/assets/close.svg?react";
import IconLink from "~/assets/link.svg?react";
import IconPlus from "~/assets/plus.svg?react";
import IconSuccess from "~/assets/success.svg?react";
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

const transactionStatusAtom = atom<
  | {
      isPending: boolean;
      isSuccessful: boolean;
      isFailed: boolean;
      transactionHash: string | null;
      message: string | null;
    }
  | undefined
>(undefined);

function poll(fn: any) {
  const endTime = Number(new Date()) + 1000 * 60 * 5;
  const interval = 3000;

  const checkCondition = (resolve: any, reject: any) => {
    if (Number(new Date()) > endTime) {
      return reject(new Error("Timed out"));
    }

    const result = fn();
    result.then((res: any) => {
      if (res) {
        resolve(res);
      } else {
        setTimeout(checkCondition, interval, resolve, reject);
      }
    });
  };

  return new Promise(checkCondition);
}

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
      <AriaButton className={css.tokenTrigger} isDisabled={!tokenBalanceMap || disabled}>
        <div className={css.tokenTrigger__icon}>{token.symbol && TOKEN_ICONS[token.symbol]}</div>
        <div className={css.tokenTrigger__name}>{token.symbol}</div>
        {token.symbol !== "VET" && <IconArrow className={css.tokenTrigger__arrow} />}
      </AriaButton>
      <Modal className={css.ModalOverlay}>
        <Dialog className={css.Modal}>
          {({ close }) => (
            <>
              <h2 className={css.Modal__heading}>
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
                className={css.Modal__search}
                placeholder="Search Token Name or Address"
                value={searchKeyword}
                onChange={setSearchKeyword}
              />
              <div className={css.Modal__content}>
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
    <div className={clsx(css.tokenInput, className)}>
      <div className={css.tokenInput__top}>
        <h3 className={css.tokenInput__label}>{label}</h3>
        <TokenModal
          label={label.toLowerCase()}
          token={token}
          tokenList={tokenList}
          setToken={onTokenChange}
          disabled={disabled}
        />
      </div>
      <TextField aria-label={label + " token amount"} className={clsx(css.tokenInput__bottom, error && css.error)}>
        <Input
          className={css.tokenInput__input}
          value={amount}
          onChange={handleInput}
          onBlur={() => (amount === "" || amount === ".") && onAmountChange("0")}
          onFocus={() => amount === "0" && onAmountChange("")}
          placeholder="0"
        />
        <div className={css.tokenInput__row}>
          {percentageList.map((item) => (
            <button
              key={item.value}
              className={css.tokenInput__button}
              onClick={() => handlePercentageClick(item.value)}
            >
              {item.name}
            </button>
          ))}
          <div className={css.tokenInput__balance}>
            Balance: {tokenBalanceMap ? tokenBalanceMap[token.symbol!].displayBalance : "0"}
          </div>
        </div>
      </TextField>
    </div>
  );
}

function SwapPanel() {
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

  const tokenList = useMemo(() => {
    return tokens.filter((i: any) => i.symbol !== fromToken.symbol && i.symbol !== toToken.symbol);
  }, [fromToken.symbol, toToken.symbol]);

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
        <div className={css.ModalOverlay}>
          <div className={css.Modal}>
            <>
              <IconError className={css.Modal__errorIcon} />
              <h2 className={clsx(css.Modal__heading, css.center)}>Warning</h2>
            </>
            <p className={css.Modal__subheading}>
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
            // TODO: remove later
            setFromToken(token);
            if (token.symbol === "B3TR") {
              setToToken(tokens[0]);
            }
          }}
          tokenList={tokenList}
          error={_fromTokenError}
          disabled={toToken.symbol === "B3TR" || toToken.symbol === "VTHO"}
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
            // TODO: remove later
            setToToken(token);
            if (token.symbol === "B3TR") {
              setFromToken(tokens[0]);
            }
          }}
          tokenList={tokenList}
          className={css.card__swapToPane}
          disabled={fromToken.symbol === "B3TR" || fromToken.symbol === "VTHO"}
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

function PoolListPane({
  pairList,
  setActivePane,
  setActivePairIndex
}: {
  pairList: sdk.Pair[];
  setActivePane: (name: string) => void;
  setActivePairIndex: (idx: number) => void;
}) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const { open } = useWalletModal();
  const { account } = useWallet();

  const _pairList = useMemo(() => {
    if (!searchKeyword) return pairList;
    return pairList.filter(
      (pair: sdk.Pair) =>
        pair.token0?.symbol?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        pair.token1?.symbol?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        pair.token0?.address?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        pair.token1?.address?.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [pairList, searchKeyword]);

  const handlePoolClick = (idx: number) => {
    if (!account) return;
    setActivePane("POOL");
    setActivePairIndex(idx);
  };

  const poolsLength = pairList?.length || 0;

  return (
    <div className={css.poolPanel}>
      <Card className={css.card}>
        <h2 className={css.card__poolHeading}>All Pool ({poolsLength})</h2>

        <SearchBox
          className={css.card__search}
          placeholder="Search"
          value={searchKeyword}
          onChange={setSearchKeyword}
        />

        {_pairList.map((pair: sdk.Pair, idx: number) => (
          <div className={css.pool} onClick={() => handlePoolClick(idx)} key={pair.liquidityToken.address}>
            <div className={css.pool__tokens}>
              <div className={css.pool__token}>{pair.token0.symbol && TOKEN_ICONS[pair.token0.symbol]}</div>
              <div className={css.pool__token}>{pair.token1.symbol && TOKEN_ICONS[pair.token1.symbol]}</div>
            </div>
            <div className={css.pool__text}>
              <div className={css.pool__name}>
                {pair.token0.symbol} / {pair.token1.symbol}
              </div>
              <div className={css.pool__value}>
                {formatBigNumber(pair.reserve0.toExact(), 2)} / {formatBigNumber(pair.reserve1.toExact(), 2)}
              </div>
            </div>
          </div>
        ))}
      </Card>
      {!account && <Button onPress={open}>Connect Wallet</Button>}
    </div>
  );
}

function PoolDetailPane({ pair, setActivePane }: { pair: sdk.Pair; setActivePane: (name: string) => void }) {
  const { open } = useWalletModal();
  const { account } = useWallet();
  const { data: myPairShare } = useMyPairShare(account, pair);

  return (
    <div className={css.poolPanel}>
      <Card className={css.card}>
        <h2 className={css.card__poolHeading}>
          <button className={css.card__poolBackButton} onClick={() => setActivePane("")}>
            <IconArrow2 />
          </button>
          {pair.token0.symbol} / {pair.token1.symbol}
        </h2>
        <section className={css.poolSection}>
          <DataEntry title="Smart Contract">
            <a
              href={`https://explore.vechain.org/accounts/${pair.liquidityToken.address}/`}
              target="_blank"
              rel="noreferrer"
            >
              <IconLink /> {truncateAddress(pair.liquidityToken.address)}
            </a>
          </DataEntry>
        </section>
        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>
            My Holdings
            <a href={`https://explore.vechain.org/accounts/${account}/`} target="_blank" rel="noreferrer">
              <IconLink /> View Activties
            </a>
          </h3>
          <DataEntry title={pair.token0.symbol!}>
            {myPairShare ? formatBigNumber(myPairShare.percentage.times(pair.reserve0.toExact())) : "0"}
          </DataEntry>
          <DataEntry title={pair.token1.symbol!}>
            {myPairShare ? formatBigNumber(myPairShare.percentage.times(pair.reserve1.toExact())) : "0"}
          </DataEntry>
          <DataEntry title="My Pool Share">
            {myPairShare ? fixedBigNumber(myPairShare.percentage.times(100), 2) : "0"}%
          </DataEntry>
        </section>
        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>Pool Status</h3>
          <DataEntry title={pair.token0.symbol!}>{formatBigNumber(pair.reserve0.toExact())}</DataEntry>
          <DataEntry title={pair.token1.symbol!}>{formatBigNumber(pair.reserve1.toExact())}</DataEntry>
        </section>
      </Card>
      {account ? (
        <div className={css.buttonGroup}>
          <Button onPress={() => setActivePane("ADD_LIQUIDITY")}>Add</Button>
          <Button outline onPress={() => setActivePane("REMOVE_LIQUIDITY")}>
            Remove
          </Button>
        </div>
      ) : (
        <Button onPress={open}>Connect Wallet</Button>
      )}
    </div>
  );
}

function AddLiquidityPane({ pair, setActivePane }: { pair: sdk.Pair; setActivePane: (name: string) => void }) {
  const { open } = useWalletModal();
  const { account } = useWallet();
  const { data: tokenBalanceMap } = useTokenBalanceList();
  const connex = useConnex();

  const [, setTransactionStatus] = useAtom(transactionStatusAtom);

  const token0 = pair.token0;
  const token1 = pair.token1;

  const [token0Amount, setToken0Amount] = useState("0");
  const [token1Amount, setToken1Amount] = useState("0");

  const _price = useMemo(() => {
    return BigNumber(pair.reserve0.toExact()).div(pair.reserve1.toExact());
  }, [pair]);

  const handleToken0Input = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setToken0Amount(value);
      const rawToken1Amount = BigNumber(value).div(_price);
      const token1Amount = rawToken1Amount.isNaN() ? "0" : fixedBigNumber(rawToken1Amount);
      setToken1Amount(token1Amount);
    }
  };

  const handleToken1Input = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setToken1Amount(value);
      const rawToken0Amount = BigNumber(value).times(_price);
      const token0Amount = rawToken0Amount.isNaN() ? "0" : fixedBigNumber(rawToken0Amount);
      setToken0Amount(token0Amount);
    }
  };

  const _token0Error = useMemo(() => {
    return BigNumber(token0Amount).isGreaterThan(tokenBalanceMap?.[token0.symbol!].displayBalance!);
  }, [token0Amount, token0, tokenBalanceMap]);

  const _token1Error = useMemo(() => {
    return BigNumber(token1Amount).isGreaterThan(tokenBalanceMap?.[token1.symbol!].displayBalance!);
  }, [token1Amount, token1, tokenBalanceMap]);

  const handleAddLiquidity = () => {
    const token0AmountWei = bigNumberToWei(token0Amount, token0.decimals);
    const token1AmountWei = bigNumberToWei(token1Amount, token1.decimals);

    if (token0.symbol === "VET" || token1.symbol === "VET") {
      const addLiquidityMethod = connex.thor
        .account(ROUTER_ADDRESS)
        .method(find(IUniswapV2Router.abi, { name: "addLiquidityETH" }))
        .value(token0.symbol === "VET" ? token0AmountWei : token1AmountWei);

      let clause, approveClause, clauses;

      if (token0.symbol === "VET") {
        const tokenAddress = token1.address;
        const amountTokenDesired = token1AmountWei;
        const amountTokenMin = BigNumber(token1AmountWei).times(0.97).toFixed(0, 1);
        const amountETHMin = BigNumber(token0AmountWei).times(0.97).toFixed(0, 1);
        clause = addLiquidityMethod.asClause(
          tokenAddress,
          amountTokenDesired,
          amountTokenMin,
          amountETHMin,
          account,
          Math.ceil(Date.now() / 1000) + 60 * 20
        );

        const approveMethod = connex.thor.account(token1.address).method(find(ABI_ERC20, { name: "approve" }));
        approveClause = approveMethod.asClause(ROUTER_ADDRESS, token1AmountWei);
        clauses = [{ ...approveClause }, { ...clause }];
      } else {
        const tokenAddress = token0.address;
        const amountTokenDesired = token0AmountWei;
        const amountTokenMin = BigNumber(token0AmountWei).times(0.97).toFixed(0, 1);
        const amountETHMin = BigNumber(token1AmountWei).times(0.97).toFixed(0, 1);
        clause = addLiquidityMethod.asClause(
          tokenAddress,
          amountTokenDesired,
          amountTokenMin,
          amountETHMin,
          account,
          Math.ceil(Date.now() / 1000) + 60 * 20
        );

        const approveMethod = connex.thor.account(token0.address).method(find(ABI_ERC20, { name: "approve" }));
        approveClause = approveMethod.asClause(ROUTER_ADDRESS, token0AmountWei);
        clauses = [{ ...approveClause }, { ...clause }];
      }

      setTransactionStatus({
        isPending: true,
        isSuccessful: false,
        isFailed: false,
        transactionHash: null,
        message: `Add liquidity ${token0Amount} ${token0.symbol} and ${token1Amount} ${token1.symbol}`
      });

      connex.vendor
        .sign("tx", clauses)
        .comment("Add Liquidity")
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
            setToken0Amount("0");
            setToken1Amount("0");
            queryClient.refetchQueries({
              queryKey: ["token-balance-list"]
            });
          }
        })
        .catch((err: any) => {
          console.log("ERROR");
          console.log(err);
          setTransactionStatus(undefined);
        });
    } else {
    }
  };

  return (
    <div className={css.poolPanel}>
      <Card className={css.card}>
        <h2 className={css.card__poolHeading}>
          <button className={css.card__poolBackButton} onClick={() => setActivePane("POOL")}>
            <IconArrow2 />
          </button>
          Add Liquidity
        </h2>

        <div className={css.liquidityInput}>
          <button className={clsx(css.tokenTrigger, css.disabled)} tabIndex={-1}>
            <div className={css.tokenTrigger__icon}>{token0.symbol && TOKEN_ICONS[token0.symbol]}</div>
            <div className={css.tokenTrigger__name}>{token0.symbol}</div>
          </button>
          <TextField className={clsx(css.tokenInput__bottom, _token0Error && css.error)} aria-label="Token amount">
            <Input
              className={css.tokenInput__input}
              value={token0Amount}
              onChange={handleToken0Input}
              onBlur={() => (token0Amount === "" || token0Amount === ".") && setToken0Amount("0")}
              onFocus={() => token0Amount === "0" && setToken0Amount("")}
            />
            <div className={css.tokenInput__balance}>
              Balance: {tokenBalanceMap?.[token0.symbol!].displayBalance || "0"}
            </div>
          </TextField>
        </div>

        <IconPlus className={css.liquidityPlus} />

        <div className={css.liquidityInput}>
          <button className={clsx(css.tokenTrigger, css.disabled)} tabIndex={-1}>
            <div className={css.tokenTrigger__icon}>{token1.symbol && TOKEN_ICONS[token1.symbol]}</div>
            <div className={css.tokenTrigger__name}>{token1.symbol}</div>
          </button>
          <TextField className={clsx(css.tokenInput__bottom, _token1Error && css.error)} aria-label="Token amount">
            <Input
              className={css.tokenInput__input}
              value={token1Amount}
              onChange={handleToken1Input}
              onBlur={() => (token1Amount === "" || token1Amount === ".") && setToken1Amount("0")}
              onFocus={() => token1Amount === "0" && setToken1Amount("")}
            />
            <div className={css.tokenInput__balance}>
              Balance: {tokenBalanceMap?.[token1.symbol!].displayBalance || "0"}
            </div>
          </TextField>
        </div>
      </Card>
      {account ? (
        <div className={css.verticalButtonGroup}>
          <Button
            onPress={handleAddLiquidity}
            disabled={
              !token0Amount ||
              !token1Amount ||
              token0Amount === "0" ||
              token1Amount === "0" ||
              _token0Error ||
              _token1Error
            }
          >
            Add Liquidity
          </Button>
        </div>
      ) : (
        <Button onPress={open}>Connect Wallet</Button>
      )}
    </div>
  );
}

function RemoveLiquidityPane({ pair, setActivePane }: { pair: sdk.Pair; setActivePane: (name: string) => void }) {
  const [value, setValue] = useState(0);
  const { account } = useWallet();
  const { data: myPairShare } = useMyPairShare(account, pair);
  const connex = useConnex();

  const [, setTransactionStatus] = useAtom(transactionStatusAtom);

  const _receiveToken0 = useMemo(() => {
    return myPairShare ? myPairShare.percentage.times(pair.reserve0.toExact()).times(value / 100) : BigNumber("0");
  }, [myPairShare, pair, value]);

  const _receiveToken1 = useMemo(() => {
    return myPairShare ? myPairShare.percentage.times(pair.reserve1.toExact()).times(value / 100) : BigNumber("0");
  }, [myPairShare, pair, value]);

  const handleRemoveLiquidity = () => {
    if (!myPairShare) return;

    if (pair.token0.symbol === "VET" || pair.token1.symbol === "VET") {
      const removeLiquidityMethod = connex.thor
        .account(ROUTER_ADDRESS)
        .method(find(IUniswapV2Router.abi, { name: "removeLiquidityETH" }));

      let clause, balance;

      if (pair.token0.symbol === "VET") {
        balance = myPairShare.myLpBalance.times(value / 100).toFixed(0, 1);
        const amountETHMin = bigNumberToWei(_receiveToken0.times(0.97), pair.token0.decimals);
        const amountTokenMin = bigNumberToWei(_receiveToken1.times(0.97), pair.token1.decimals);
        clause = removeLiquidityMethod.asClause(
          pair.token1.address,
          balance,
          amountTokenMin,
          amountETHMin,
          account,
          Math.ceil(Date.now() / 1000) + 60 * 20
        );
      } else {
        balance = myPairShare.myLpBalance.times(value / 100).toFixed(0, 1);
        const amountETHMin = bigNumberToWei(_receiveToken1.times(0.97), pair.token1.decimals);
        const amountTokenMin = bigNumberToWei(_receiveToken0.times(0.97), pair.token0.decimals);
        clause = removeLiquidityMethod.asClause(
          pair.token0.address,
          balance,
          amountTokenMin,
          amountETHMin,
          account,
          Math.ceil(Date.now() / 1000) + 60 * 20
        );
      }

      let approveClause;
      if (BigNumber(balance).isGreaterThan(myPairShare.myLpAllowance)) {
        const approveMethod = connex.thor
          .account(pair.liquidityToken.address)
          .method(find(ABI_ERC20, { name: "approve" }));
        approveClause = approveMethod.asClause(ROUTER_ADDRESS, balance);
      }

      setTransactionStatus({
        isPending: true,
        isSuccessful: false,
        isFailed: false,
        transactionHash: null,
        message: `Remove liquidity ${value}%`
      });

      connex.vendor
        .sign("tx", approveClause ? [{ ...approveClause }, { ...clause }] : [{ ...clause }])
        .comment("Remove Liquidity")
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
            setValue(0);
            queryClient.refetchQueries({
              queryKey: ["token-balance-list"]
            });
          }
        })
        .catch((err: any) => {
          console.log("ERROR");
          console.log(err);
          setTransactionStatus(undefined);
        });
    } else {
      // TODO: removeLiquidity
    }
  };

  return (
    <div className={css.poolPanel}>
      <Card className={css.card}>
        <h2 className={css.card__poolHeading}>
          <button className={css.card__poolBackButton} onClick={() => setActivePane("POOL")}>
            <IconArrow2 />
          </button>
          Remove Liquidity
        </h2>

        <Slider className={css.slider} value={value} onChange={setValue} aria-label="Remove liquidity percentage">
          <h4 className={css.slider__heading}>Amount</h4>
          <SliderOutput className={css.slider__output} />
          <SliderTrack className={css.slider__track}>
            {({ state }) => (
              <>
                <div className={css.slider__fill} style={{ width: state.getThumbPercent(0) * 100 + "%" }} />
                <SliderThumb className={css.slider__thumb} />
              </>
            )}
          </SliderTrack>
        </Slider>
        <div className={css.sliderButtonGroup}>
          <button
            className={clsx(css.sliderButtonGroup__button, value === 0 && css.active)}
            onMouseDown={() => setValue(0)}
          >
            0%
          </button>
          <button
            className={clsx(css.sliderButtonGroup__button, value === 25 && css.active)}
            onMouseDown={() => setValue(25)}
          >
            25%
          </button>
          <button
            className={clsx(css.sliderButtonGroup__button, value === 50 && css.active)}
            onMouseDown={() => setValue(50)}
          >
            50%
          </button>
          <button
            className={clsx(css.sliderButtonGroup__button, value === 75 && css.active)}
            onMouseDown={() => setValue(75)}
          >
            75%
          </button>
          <button
            className={clsx(css.sliderButtonGroup__button, value === 100 && css.active)}
            onMouseDown={() => setValue(100)}
          >
            100%
          </button>
        </div>

        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>You will receive</h3>
          <DataEntry title={pair.token0.symbol!}>{formatBigNumber(_receiveToken0)}</DataEntry>
          <DataEntry title={pair.token1.symbol!}>{formatBigNumber(_receiveToken1)}</DataEntry>
        </section>
      </Card>

      <Button onPress={handleRemoveLiquidity} disabled={!value || !myPairShare?.percentage}>
        Remove Liquidity
      </Button>
    </div>
  );
}

function PoolPanel() {
  const [activePane, setActivePane] = useState("");
  const [activePairIndex, setActivePairIndex] = useState(0);
  const { data: pairList, isPending } = useFeaturedPairList();

  if (isPending) {
    return (
      <div className={css.loadingPanel}>
        <Card className={css.card}>Loading...</Card>
      </div>
    );
  }

  if (activePane === "POOL") {
    return <PoolDetailPane pair={pairList![activePairIndex]} setActivePane={setActivePane} />;
  }

  if (activePane === "ADD_LIQUIDITY") {
    return <AddLiquidityPane pair={pairList![activePairIndex]} setActivePane={setActivePane} />;
  }

  if (activePane === "REMOVE_LIQUIDITY") {
    return <RemoveLiquidityPane pair={pairList![activePairIndex]} setActivePane={setActivePane} />;
  }

  return <PoolListPane pairList={pairList!} setActivePane={setActivePane} setActivePairIndex={setActivePairIndex} />;
}

const claimAddresses = [
  "0x0fa367d0b916128a2e66a7744394a64e6af5f31b", // test
  "0x53425ed53140c53b9fd7c024cc8b5bf8b6e09bf6", // round1
  "0xF48B13252555eA5Ae5019ca24e0C30893Afb478C" // round2
];
const claimHeadings = ["Test", "Launched the $B3TR/ $VET trading pair on VeSwap!", "2K followers"];

function ClaimPanel() {
  const { account } = useWallet();
  const connex = useConnex();
  const [claimedRecord, setClaimedRecord] = useState([false, false, false]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTransactionStatus] = useAtom(transactionStatusAtom);

  const rewards = useMemo(() => {
    if (!account) return [];
    return [
      Object.entries(rewardTestData.claims).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1],
      Object.entries(rewardRonud1Data.claims).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1],
      Object.entries(rewardRonud2Data.claims).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1]
    ];
  }, [account]);

  useEffect(() => {
    async function fetchRewardData() {
      if (!rewards || !connex) return;

      try {
        const isTestClaimed =
          rewards[0] &&
          (await connex.thor
            .account(claimAddresses[0])
            .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
            .call(rewards[0].index));
        const isRound1Claimed =
          rewards[1] &&
          (await connex.thor
            .account(claimAddresses[1])
            .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
            .call(rewards[1].index));
        const isRound2Claimed =
          rewards[2] &&
          (await connex.thor
            .account(claimAddresses[2])
            .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
            .call(rewards[2].index));

        setClaimedRecord([isTestClaimed?.decoded["0"], isRound1Claimed?.decoded["0"], isRound2Claimed?.decoded["0"]]);
      } catch (error) {
        console.log("fetch claimed data error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRewardData();
  }, [connex, rewards, setIsLoading, setClaimedRecord]);

  const handleClaim = async (idx: number) => {
    const reward: any = rewards![idx];
    const method = connex.thor.account(claimAddresses[idx]).method(find(ABI_MerkleDistributor.abi, { name: "claim" }));
    const clause = method.asClause(reward.index, account, reward.amount, reward.proof);

    setTransactionStatus({
      isPending: true,
      isSuccessful: false,
      isFailed: false,
      transactionHash: null,
      message: `Claim Reward`
    });

    connex.vendor
      .sign("tx", [clause])
      .comment("Claim Reward")
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
          setClaimedRecord((prev) => {
            const newRecord = [...prev];
            newRecord[idx] = true;
            return newRecord;
          });
        }
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
        setTransactionStatus(undefined);
      });
  };

  if (!account) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>Please connect your wallet before proceeding.</Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>Loading...</Card>
      </div>
    );
  }

  if (!rewards.length || rewards.every((i) => !i)) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>Sorry, you have no rewards at this time.</Card>
      </div>
    );
  }

  return (
    <div className={css.claimGrid}>
      {rewards.slice(0, 2).map((reward: any, idx: number) => {
        if (!reward) return null;
        return (
          <div className={css.claimPanel} key={`reward-${idx}`}>
            <Card className={css.card}>
              <h2 className={css.card__claimHeading}>{claimHeadings[idx]}</h2>
              <div className={css.card__claimValue}>{BigNumber(reward.amount).div(1e18).toString()}</div>
            </Card>
            {claimedRecord[idx] ? (
              <Button disabled>Already Claimed</Button>
            ) : (
              <Button onPress={() => handleClaim(idx)}>Claim</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Swap() {
  const [transactionStatus, setTransactionStatus] = useAtom(transactionStatusAtom);

  return (
    <div className={css.page}>
      {transactionStatus && (
        <div className={css.ModalOverlay}>
          <div className={css.Modal}>
            {transactionStatus.isPending && (
              <>
                <div className={css.loader} />
                <h2 className={clsx(css.Modal__heading, css.center)}>Waiting for confirmation...</h2>
              </>
            )}
            {transactionStatus.isSuccessful && (
              <>
                <IconSuccess className={css.Modal__successIcon} />
                <h2 className={clsx(css.Modal__heading, css.center)}>Transaction Successful</h2>
              </>
            )}
            {transactionStatus.isFailed && (
              <>
                <IconError className={css.Modal__errorIcon} />
                <h2 className={clsx(css.Modal__heading, css.center)}>Transaction Failed</h2>
              </>
            )}
            {!!transactionStatus.message && <p className={css.Modal__subheading}>{transactionStatus.message}</p>}
            {!transactionStatus.isPending && (
              <div className={css.Modal__bgroup}>
                <a
                  className={css.Modal__link}
                  href={`https://explore.vechain.org/transactions/${transactionStatus.transactionHash}#info`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on explorer
                </a>
                <button className={css.Modal__close} onClick={() => setTransactionStatus(undefined)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Tabs>
        <TabList className={css.tabList} aria-label="Swap Tabs">
          <Tab className={css.tabButton} id="Swap">
            Swap
          </Tab>
          <Tab className={css.tabButton} id="Pool">
            Pool
          </Tab>
          <Tab className={css.tabButton} id="Claim">
            Claim
          </Tab>
        </TabList>
        <TabPanel id="Swap">
          <SwapPanel />
        </TabPanel>
        <TabPanel id="Pool">
          <PoolPanel />
        </TabPanel>
        <TabPanel id="Claim">
          <ClaimPanel />
        </TabPanel>
      </Tabs>
    </div>
  );
}
