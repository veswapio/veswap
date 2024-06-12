import { clsx } from "clsx";
import { find } from "lodash";
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
// import ABI_FACTORY from "~/abis/factory.json";

import sdk from "~/sdk";
import tokens from "~/constants/tokens";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import useTokenBalanceList from "~/hooks/useTokenBalanceList";
import usePairList from "~/hooks/usePairList";
import useMyPairShare from "~/hooks/useMyPairShare";
import { truncateAddress, formatBigNumber, fixedBigNumber, bigNumberToWei } from "~/utils/helpers";
// import { queryClient } from "~/query";

import Card from "~/components/Card";
import Button from "~/components/Button";
import DataEntry from "~/components/DataEntry";
import Tooltip from "~/components/Tooltip";
import SearchBox from "~/components/SearchBox";
import css from "./Swap.module.scss";

// import IconArrow from "~/assets/arrow.svg?react";
import IconArrow2 from "~/assets/arrow2.svg?react";
import IconSwap from "~/assets/swap.svg?react";
import IconClose from "~/assets/close.svg?react";
import IconLink from "~/assets/link.svg?react";
import IconPlus from "~/assets/plus.svg?react";
import BigNumber from "bignumber.js";

// token icons
import TokenIconVet from "~/assets/tokens/vet.svg?react";
import TokenIconVtho from "~/assets/tokens/vtho.svg?react";

const TOKEN_ICONS: { [key: string]: any } = {
  VET: <TokenIconVet />,
  VTHO: <TokenIconVtho />
};

function TokenModal({
  label,
  token,
  setToken,
  tokenList
}: {
  label: string;
  token: sdk.Token;
  setToken: (token: sdk.Token) => void;
  tokenList: sdk.Token[];
}) {
  const { data: tokenBalanceMap } = useTokenBalanceList();
  const [searchKeyword, setSearchKeyword] = useState("");

  const _tokenList = useMemo(() => {
    if (!searchKeyword) return tokenList;
    return tokenList.filter((i: any) => i.symbol.toLowerCase().includes(searchKeyword.toLowerCase()));
  }, [tokenList, searchKeyword]);

  return (
    <DialogTrigger>
      <AriaButton className={css.tokenTrigger} isDisabled={!tokenBalanceMap || true}>
        <div className={css.tokenTrigger__icon}>{token.symbol && TOKEN_ICONS[token.symbol]}</div>
        <div className={css.tokenTrigger__name}>{token.symbol}</div>
        {/* <IconArrow className={css.tokenTrigger__arrow} /> */}
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
                placeholder="Search Token"
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
  className
}: {
  label: string;
  token: sdk.Token;
  amount: string;
  onAmountChange: (value: string) => void;
  onTokenChange: (token: sdk.Token) => void;
  tokenList: sdk.Token[];
  error?: boolean;
  className?: string;
}) {
  const { data: tokenBalanceMap } = useTokenBalanceList();

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  return (
    <div className={clsx(css.tokenInput, className)}>
      <div className={css.tokenInput__top}>
        <h3 className={css.tokenInput__label}>{label}</h3>
        <TokenModal label={label.toLowerCase()} token={token} tokenList={tokenList} setToken={onTokenChange} />
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
        <div className={css.tokenInput__balance}>
          Balance: {tokenBalanceMap ? tokenBalanceMap[token.symbol!].displayBalance : "0"}
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

  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromTokenAmount, setFromTokenAmount] = useState("0");
  const [toTokenAmount, setToTokenAmount] = useState("0");
  const [slippage, setSlippage] = useState("0.01");
  const [pairData, setPairData] = useState<sdk.Pair | undefined>(undefined);
  const [isExactIn, setIsExactIn] = useState(true);

  const _reserveA = useMemo(() => {
    if (!pairData) return;
    const value = pairData.token0.symbol === fromToken.symbol ? pairData.reserve0 : pairData.reserve1;
    return BigNumber(value.raw.toString());
  }, [pairData, fromToken]);

  const _reserveB = useMemo(() => {
    if (!pairData) return;
    const value = pairData.token1.symbol === toToken.symbol ? pairData.reserve1 : pairData.reserve0;
    return BigNumber(value.raw.toString());
  }, [pairData, toToken]);

  const _price = useMemo(() => {
    if (!_reserveA || !_reserveB) return BigNumber("0");
    return _reserveA.div(_reserveB);
  }, [_reserveA, _reserveB]);

  const tokenList = useMemo(() => {
    return tokens.filter((i: any) => i.symbol !== fromToken.symbol && i.symbol !== toToken.symbol);
  }, [fromToken.symbol, toToken.symbol]);

  const handleFromTokenChange = (value: string) => {
    if (!_reserveA || !_reserveB) return;

    const amountOut = BigNumber(value).div(_price);
    setFromTokenAmount(value);
    setToTokenAmount(amountOut.isNaN() ? "0" : fixedBigNumber(amountOut));
    setIsExactIn(true);
  };

  const handleToTokenChange = (value: string) => {
    if (!_reserveA || !_reserveB) return;

    const amountIn = BigNumber(value).times(_price);
    setToTokenAmount(value);
    setFromTokenAmount(amountIn.isNaN() ? "0" : fixedBigNumber(amountIn));
    setIsExactIn(false);
  };

  const _fromTokenError = useMemo(() => {
    return BigNumber(fromTokenAmount).isGreaterThan(tokenBalanceMap?.[fromToken.symbol!].displayBalance!);
  }, [fromTokenAmount, fromToken, tokenBalanceMap]);

  const _toTokenError = useMemo(() => {
    return BigNumber(toTokenAmount).isGreaterThan(tokenBalanceMap?.[toToken.symbol!].displayBalance!);
  }, [toTokenAmount, toToken, tokenBalanceMap]);

  const handleApprove = async (address: string) => {
    const approveMethod = connex.thor.account(address).method(find(ABI_ERC20, { name: "approve" }));
    const clause = approveMethod.asClause(ROUTER_ADDRESS, (10n ** 24n).toString());

    connex.vendor
      .sign("tx", [{ ...clause }])
      .comment("Approve")
      .request()
      .then((tx: any) => {
        console.log(tx);
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
      });
  };

  const handleSwapTokens = () => {
    const _fromToken = fromToken;
    setFromToken(toToken);
    setToToken(_fromToken);

    const amountOut = BigNumber(fromTokenAmount).times(_price);
    setToTokenAmount(amountOut.isNaN() ? "0" : fixedBigNumber(amountOut));
    setIsExactIn(true);
  };

  const swapTokensForExactETH = () => {
    const clause = connex.thor
      .account(ROUTER_ADDRESS)
      .method(find(IUniswapV2Router.abi, { name: "swapTokensForExactETH" }))
      .asClause(
        bigNumberToWei(toTokenAmount, toToken.decimals),
        bigNumberToWei(BigNumber(fromTokenAmount).times(1 + +slippage), fromToken.decimals),
        [fromToken.address, toToken.address],
        account,
        Math.ceil(Date.now() / 1000) + 60 * 20
      );

    connex.vendor
      .sign("tx", [{ ...clause }])
      .comment("swapTokensForExactETH")
      .request()
      .then((tx: any) => {
        console.log("result: ", tx);
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
      });
  };

  const swapExactTokensForETH = () => {
    const clause = connex.thor
      .account(ROUTER_ADDRESS)
      .method(find(IUniswapV2Router.abi, { name: "swapExactTokensForETH" }))
      .asClause(
        bigNumberToWei(fromTokenAmount, fromToken.decimals),
        bigNumberToWei(BigNumber(toTokenAmount).times(1 - +slippage), toToken.decimals),
        [fromToken.address, toToken.address],
        account,
        Math.ceil(Date.now() / 1000) + 60 * 20
      );

    connex.vendor
      .sign("tx", [{ ...clause }])
      .comment("swapExactTokensForETH")
      .request()
      .then((tx: any) => {
        console.log("result: ", tx);
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
      });
  };

  const swapExactETHForTokens = () => {
    const clause = connex.thor
      .account(ROUTER_ADDRESS)
      .method(find(IUniswapV2Router.abi, { name: "swapExactETHForTokens" }))
      .asClause(
        // TODO: fix calculation
        bigNumberToWei(BigNumber(toTokenAmount).times(1 - +slippage), toToken.decimals),
        [fromToken.address, toToken.address],
        account,
        Math.ceil(Date.now() / 1000) + 60 * 20
      );

    connex.vendor
      .sign("tx", [{ ...clause, value: bigNumberToWei(fromTokenAmount, 18) }])
      .comment("swapExactETHForTokens")
      .request()
      .then((tx: any) => {
        console.log("result: ", tx);
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
      });
  };

  const swapETHForExactTokens = () => {
    const clause = connex.thor
      .account(ROUTER_ADDRESS)
      .method(find(IUniswapV2Router.abi, { name: "swapETHForExactTokens" }))
      .asClause(
        bigNumberToWei(toTokenAmount, toToken.decimals),
        [fromToken.address, toToken.address],
        account,
        Math.ceil(Date.now() / 1000) + 60 * 20
      );

    connex.vendor
      .sign("tx", [{ ...clause }])
      .comment("swapETHForExactTokens")
      .request()
      .then((tx: any) => {
        console.log("result: ", tx);
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
      });
  };

  const handleSwap = () => {
    if (isExactIn) {
      if (fromToken.symbol === "VET") {
        swapExactETHForTokens();
      } else {
        swapExactTokensForETH();
      }
    } else {
      if (fromToken.symbol === "VET") {
        swapETHForExactTokens();
      } else {
        swapTokensForExactETH();
      }
    }
  };

  useEffect(() => {
    async function fetchData() {
      const tokenA = new sdk.Token(1, fromToken.address, fromToken.decimals, fromToken.symbol);
      const tokenB = new sdk.Token(1, toToken.address, toToken.decimals, toToken.symbol);
      const pairData = await sdk.Fetcher.fetchPairData(tokenA, tokenB, connex);
      setPairData(pairData);
    }

    fetchData();
  }, [fromToken, toToken, connex, setPairData]);

  return (
    <div className={css.swapPanel}>
      <Card className={css.card}>
        <TokenInput
          label="From"
          token={fromToken}
          amount={fromTokenAmount}
          onAmountChange={handleFromTokenChange}
          onTokenChange={setFromToken}
          tokenList={tokenList}
          error={_fromTokenError}
        />
        <button className={css.swapButton} onClick={handleSwapTokens} tabIndex={-1}>
          <IconSwap />
        </button>
        <TokenInput
          label="To"
          token={toToken}
          amount={toTokenAmount}
          onAmountChange={handleToTokenChange}
          onTokenChange={setToToken}
          tokenList={tokenList}
          className={css.card__swapToPane}
          error={_toTokenError}
        />

        <DataEntry
          title="Slippage"
          tooltip="Your transaction will be reverted if the price changes unfavorably by more than this percentage."
        >
          <RadioGroup
            orientation="horizontal"
            defaultValue={slippage}
            className={css.slippage}
            onChange={setSlippage}
            aria-label="slippage"
          >
            <Radio className={css.slippage__option} value="0.001">
              0.1%
            </Radio>
            <Radio className={css.slippage__option} value="0.005">
              0.5%
            </Radio>
            <Radio className={css.slippage__option} value="0.01">
              1%
            </Radio>
          </RadioGroup>
        </DataEntry>
        <DataEntry title="Price">
          {formatBigNumber(_price)} {fromToken.symbol} per {toToken.symbol}
        </DataEntry>
        <DataEntry title="Route">
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
          0.1%
        </DataEntry>
        <div className={css.card__help}>
          <a href="">Need help? View the user&apos;s guide</a>
        </div>
      </Card>
      {account ? (
        <div className={css.verticalButtonGroup}>
          {tokenBalanceMap?.[fromToken.symbol!].needApprove && (
            <Button onPress={() => handleApprove(tokenBalanceMap?.[fromToken.symbol!].address)}>
              Approve {fromToken.symbol}
            </Button>
          )}

          {tokenBalanceMap?.[toToken.symbol!].needApprove && (
            <Button onPress={() => handleApprove(tokenBalanceMap?.[toToken.symbol!].address)}>
              Approve {toToken.symbol}
            </Button>
          )}

          <Button
            onPress={handleSwap}
            disabled={
              !fromTokenAmount ||
              !toTokenAmount ||
              fromTokenAmount === "0" ||
              toTokenAmount === "0" ||
              _fromTokenError ||
              _toTokenError ||
              tokenBalanceMap?.[fromToken.symbol!].needApprove ||
              tokenBalanceMap?.[toToken.symbol!].needApprove
            }
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

function PoolListPane({ pairList, setActivePane }: { pairList: sdk.Pair[]; setActivePane: (name: string) => void }) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const { open } = useWalletModal();
  const { account } = useWallet();

  const handlePoolClick = () => {
    if (!account) return;
    setActivePane("POOL");
  };

  return (
    <div className={css.poolPanel}>
      <Card className={css.card}>
        <h2 className={css.card__poolHeading}>All Pool (1)</h2>

        <SearchBox
          className={css.card__search}
          placeholder="Search"
          value={searchKeyword}
          onChange={setSearchKeyword}
        />

        {pairList.map((pair: sdk.Pair) => (
          <div className={css.pool} onClick={handlePoolClick} key={pair.liquidityToken.address}>
            <div className={css.pool__tokens}>
              <div className={css.pool__token}>{pair.token0.symbol && TOKEN_ICONS[pair.token0.symbol]}</div>
              <div className={css.pool__token}>{pair.token1.symbol && TOKEN_ICONS[pair.token1.symbol]}</div>
            </div>
            <div className={css.pool__name}>
              {pair.token0.symbol} / {pair.token1.symbol}
            </div>
            <div className={css.pool__value}>
              {formatBigNumber(pair.reserve0.toExact())} / {formatBigNumber(pair.reserve1.toExact())}
            </div>
          </div>
        ))}

        <div className={css.card__help}>
          <a href="">Need help? View the user&apos;s guide</a>
        </div>
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
        <div className={css.card__help}>
          <a href="">Need help? View the user&apos;s guide</a>
        </div>
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

  // const calculatePairAddr = async () => {
  //   const FACTORY = "0x814ab84a151662c6d1f8142abce02ca25c05905e";
  //   const VVET = "0x45429a2255e7248e57fce99e7239aed3f84b7a53";
  //   connex.thor
  //     .account(FACTORY)
  //     .method(find(ABI_FACTORY, { name: "createPair" }))
  //     .call(tokens[1].address, VVET)
  //     .then((res: any) => {
  //       console.log(res);
  //     });
  // };

  const handleApprove = async (address: string) => {
    const approveMethod = connex.thor.account(address).method(find(ABI_ERC20, { name: "approve" }));
    const clause = approveMethod.asClause(ROUTER_ADDRESS, (10n ** 24n).toString());

    connex.vendor
      .sign("tx", [{ ...clause }])
      .comment("Approve")
      .request()
      .then((tx: any) => {
        console.log(tx);
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
      });
  };

  // const approvePair = async () => {
  //   const PAIR = "0x3946ad2ca036489f5a90dbb4c72fb31aff98ef11";
  //   const VTHO = "0x0000000000000000000000000000456E65726779";
  //   const approveMethod = connex.thor.account(VTHO).method(find(ABI_ERC20, { name: "approve" }));
  //   const clause = approveMethod.asClause(PAIR, (10 * 1e18).toString());

  //   connex.vendor
  //     .sign("tx", [{ ...clause }])
  //     .comment("Approve")
  //     .request()
  //     .then((tx: any) => {
  //       console.log(tx);
  //     })
  //     .catch((err: any) => {
  //       console.log("ERROR");
  //       console.log(err);
  //     });
  // };

  // const simulateAddLiquidity = () => {
  //   const addLiquidityABI = find(IUniswapV2Router.abi, { name: "addLiquidityETH" });

  //   connex.thor
  //     .account(ROUTER_ADDRESS)
  //     .method(addLiquidityABI)
  //     .value((1 * 1e18).toString())
  //     .call(
  //       tokens[1].address,
  //       (10 * 1e18).toString(),
  //       (0 * 1e18).toString(),
  //       (1 * 1e18).toString(),
  //       account,
  //       Math.ceil(Date.now() / 1000) + 60 * 20
  //     )
  //     .then((res: any) => {
  //       console.log(res.data);
  //     });
  // };

  // const checkConstructor = async () => {
  //   const addLiquidityABI = find(IUniswapV2Router.abi, { name: "WETH" });
  //   const WETH = await connex.thor.account(ROUTER_ADDRESS).method(addLiquidityABI).call();
  //   const factory = await connex.thor
  //     .account(ROUTER_ADDRESS)
  //     .method(find(IUniswapV2Router.abi, { name: "factory" }))
  //     .call();
  //   console.log(WETH);
  //   console.log(factory);
  // };

  const handleAddLiquidity = () => {
    const token0AmountWei = bigNumberToWei(token0Amount, token0.decimals);
    const token1AmountWei = bigNumberToWei(token1Amount, token1.decimals);

    if (token0.symbol === "VET" || token1.symbol === "VET") {
      const addLiquidityABI = find(IUniswapV2Router.abi, { name: "addLiquidityETH" });
      const addLiquidityMethod = connex.thor.account(ROUTER_ADDRESS).method(addLiquidityABI).value(token0AmountWei);

      // TODO: Add slippage tolerance?
      const addLiquidityArugments =
        token0.symbol === "VET"
          ? [
              token1.address,
              token1AmountWei,
              BigNumber(token1AmountWei).times(0.997).toFixed(0, 1),
              BigNumber(token0AmountWei).times(0.997).toFixed(0, 1),
              account,
              Math.ceil(Date.now() / 1000) + 60 * 20
            ]
          : [
              token0.address,
              token0AmountWei,
              BigNumber(token0AmountWei).times(0.997).toFixed(0, 1),
              BigNumber(token1AmountWei).times(0.997).toFixed(0, 1),
              account,
              Math.ceil(Date.now() / 1000) + 60 * 20
            ];

      const clause = addLiquidityMethod.asClause(...addLiquidityArugments);

      connex.vendor
        .sign("tx", [{ ...clause }])
        .comment("Add Liquidity")
        .request()
        .then((tx: any) => {
          console.log("result: ", tx);
        })
        .catch((err: any) => {
          console.log("ERROR");
          console.log(err);
        });
    } else {
      // TODO: addLiquidity
    }
  };

  // const handleAddLiquidity = () => {
  //   const transaction = connex.thor.transaction("0x4a629aed45d89f3611bc04b9860557b9d1f1d5bd2dd6bdaea3c1a6286af4cf89");
  //   transaction.getReceipt().then((tx: any) => {
  //     console.log(tx);
  //   });
  // };

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
          {tokenBalanceMap?.[token0.symbol!].needApprove && (
            <Button onPress={() => handleApprove(tokenBalanceMap?.[token0.symbol!].address)}>
              Approve {token0.symbol}
            </Button>
          )}

          {tokenBalanceMap?.[token1.symbol!].needApprove && (
            <Button onPress={() => handleApprove(tokenBalanceMap?.[token1.symbol!].address)}>
              Approve {token1.symbol}
            </Button>
          )}

          <Button
            onPress={handleAddLiquidity}
            disabled={
              !token0Amount ||
              !token1Amount ||
              token0Amount === "0" ||
              token1Amount === "0" ||
              _token0Error ||
              _token1Error ||
              tokenBalanceMap?.[token0.symbol!].needApprove ||
              tokenBalanceMap?.[token1.symbol!].needApprove
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

  const _receiveToken0 = useMemo(() => {
    return myPairShare ? myPairShare.percentage.times(pair.reserve0.toExact()).times(value / 100) : BigNumber("0");
  }, [myPairShare, pair, value]);

  const _receiveToken1 = useMemo(() => {
    return myPairShare ? myPairShare.percentage.times(pair.reserve1.toExact()).times(value / 100) : BigNumber("0");
  }, [myPairShare, pair, value]);

  const handleRemoveLiquidity = () => {
    if (!myPairShare) return;

    if (pair.token0.symbol === "VET" || pair.token1.symbol === "VET") {
      const removeLiquidityABI = find(IUniswapV2Router.abi, { name: "removeLiquidityETH" });
      const removeLiquidityMethod = connex.thor.account(ROUTER_ADDRESS).method(removeLiquidityABI);

      const removeLpWei = myPairShare.myLpBalance.times(value / 100).toFixed(0, 1);
      const receiveToken0Wei = bigNumberToWei(_receiveToken0.times(0.97), pair.token0.decimals);
      const receiveToken1Wei = bigNumberToWei(_receiveToken1.times(0.97), pair.token1.decimals);

      const removeLiquidityArugments =
        pair.token0.symbol === "VET"
          ? [
              pair.token1.address,
              removeLpWei,
              receiveToken1Wei,
              receiveToken0Wei,
              account,
              Math.ceil(Date.now() / 1000) + 60 * 20
            ]
          : [
              pair.token0.address,
              removeLpWei,
              receiveToken0Wei,
              receiveToken1Wei,
              account,
              Math.ceil(Date.now() / 1000) + 60 * 20
            ];

      const clause = removeLiquidityMethod.asClause(...removeLiquidityArugments);

      connex.vendor
        .sign("tx", [{ ...clause }])
        .comment("Remove Liquidity")
        .request()
        .then((tx: any) => {
          console.log("result: ", tx);
        })
        .catch((err: any) => {
          console.log("ERROR");
          console.log(err);
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

      <Button onPress={handleRemoveLiquidity} disabled={!value || !myPairShare?.percentage || myPairShare?.needApprove}>
        Remove Liquidity
      </Button>
    </div>
  );
}

function PoolPanel() {
  const [activePane, setActivePane] = useState("");
  const { data: pairList, isPending } = usePairList();

  if (isPending) {
    return (
      <div className={css.loadingPanel}>
        <Card className={css.card}>Loading...</Card>
      </div>
    );
  }

  if (activePane === "POOL") {
    return <PoolDetailPane pair={pairList![0]} setActivePane={setActivePane} />;
  }

  if (activePane === "ADD_LIQUIDITY") {
    return <AddLiquidityPane pair={pairList![0]} setActivePane={setActivePane} />;
  }

  if (activePane === "REMOVE_LIQUIDITY") {
    return <RemoveLiquidityPane pair={pairList![0]} setActivePane={setActivePane} />;
  }

  return <PoolListPane pairList={pairList!} setActivePane={setActivePane} />;
}

function ClaimPanel() {
  const { open } = useWalletModal();
  const { account } = useWallet();

  return (
    <div className={css.claimPanel}>
      <Card className={css.card}>
        <h2 className={css.card__claimHeading}>
          Claimable VTHO
          <Tooltip content="Liquidity providers can safely claim VTHO rewards by providing VET asset." />
        </h2>
        <div className={css.card__claimValue}>0.00</div>
      </Card>
      {account ? <Button disabled>Claim</Button> : <Button onPress={open}>Connect Wallet</Button>}
    </div>
  );
}

export default function Swap() {
  return (
    <div className={css.page}>
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
