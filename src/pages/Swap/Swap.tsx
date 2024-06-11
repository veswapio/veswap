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
import { toWei, truncateAddress } from "~/utils/helpers";
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
        <div className={css.tokenTrigger__icon}></div>
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
                    <div className={css.tokenEntry__icon}></div>
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
  className
}: {
  label: string;
  token: sdk.Token;
  amount: string;
  onAmountChange: (value: string) => void;
  onTokenChange: (token: sdk.Token) => void;
  tokenList: sdk.Token[];
  className?: string;
}) {
  const { data: tokenBalanceMap } = useTokenBalanceList();
  const [error, setError] = useState(false);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);

      if (+value > +tokenBalanceMap?.[token.symbol!].displayBalance!) {
        setError(true);
      } else {
        setError(false);
      }
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
  const connex = useConnex();

  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromTokenAmount, setFromTokenAmount] = useState("0");
  const [toTokenAmount, setToTokenAmount] = useState("0");
  const [slippage, setSlippage] = useState("0.01");
  const [pairData, setPairData] = useState<sdk.Pair | undefined>(undefined);
  const [isExactIn, setIsExactIn] = useState(true);

  const tokenList = useMemo(() => {
    return tokens.filter((i: any) => i.symbol !== fromToken.symbol && i.symbol !== toToken.symbol);
  }, [fromToken.symbol, toToken.symbol]);

  const _price = useMemo(() => {
    if (!pairData) return "--";

    const reserveA = pairData.token0.symbol === fromToken.symbol ? pairData.reserve0 : pairData.reserve1;
    const reserveB = pairData.token1.symbol === toToken.symbol ? pairData.reserve1 : pairData.reserve0;

    return (+reserveA.toExact() / +reserveB.toExact()).toFixed(6).replace(/(\.0*|0+)$/, "");
  }, [fromToken, toToken, pairData]);

  const handleFromTokenChange = (value: string) => {
    setFromTokenAmount(value);
    setToTokenAmount((+value / +_price).toFixed(6).replace(/(\.0*|0+)$/, ""));
    setIsExactIn(true);
  };

  const handleToTokenChange = (value: string) => {
    setToTokenAmount(value);
    setFromTokenAmount((+value * +_price).toFixed(6).replace(/(\.0*|0+)$/, ""));
    setIsExactIn(false);
  };

  const handleSwapTokens = () => {
    const _fromToken = fromToken;
    setFromToken(toToken);
    setToToken(_fromToken);
  };

  const handleSwap = () => {
    console.log("swap");
    console.log("fromTokenAddress", fromToken.address);
    console.log("fromTokenAmount", toWei(fromTokenAmount, fromToken.decimals));
    console.log("toTokenAddress", toToken.address);
    console.log("toTokenAmount", toWei(toTokenAmount, toToken.decimals));
    console.log("slippage", slippage);
    console.log("isExactIn", isExactIn);
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
        />
        <button className={css.swapButton} onClick={handleSwapTokens}>
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
          {_price} {fromToken.symbol} per {toToken.symbol}
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
      {account ? <Button onPress={handleSwap}>Swap</Button> : <Button onPress={open}>Connect Wallet</Button>}
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
              <div className={css.pool__token}></div>
              <div className={css.pool__token}></div>
            </div>
            <div className={css.pool__name}>
              {pair.token0.symbol} / {pair.token1.symbol}
            </div>
            <div className={css.pool__value}>
              {pair.reserve0.toExact()} / {pair.reserve1.toExact()}
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
          Pool Name
        </h2>
        <section className={css.poolSection}>
          <DataEntry title="Smart Contract">
            <a
              href={`https://explore.vechain.org/accounts/${pair.liquidityToken.address}/`}
              target="_blank"
              rel="noopener"
            >
              <IconLink /> {truncateAddress(pair.liquidityToken.address)}
            </a>
          </DataEntry>
        </section>
        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>
            My Holdings
            <a href={`https://explore.vechain.org/accounts/${account}/`} target="_blank" rel="noopener">
              <IconLink /> View Activties
            </a>
          </h3>
          <DataEntry title={pair.token0.symbol!}>
            {myPairShare ? (+pair.reserve0.toExact() * myPairShare).toFixed(2) : "0"}
          </DataEntry>
          <DataEntry title={pair.token1.symbol!}>
            {myPairShare ? (+pair.reserve1.toExact() * myPairShare).toFixed(2) : "0"}
          </DataEntry>
          <DataEntry title="My Pool Share">{myPairShare ? (myPairShare * 100).toFixed(2) : "0"}%</DataEntry>
        </section>
        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>Pool Status</h3>
          <DataEntry title={pair.token0.symbol!}>{pair.reserve0.toExact()}</DataEntry>
          <DataEntry title={pair.token1.symbol!}>{pair.reserve1.toExact()}</DataEntry>
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

  const [token0Error, setToken0Error] = useState(false);
  const [token1Error, setToken1Error] = useState(false);

  const handleToken0Input = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setToken0Amount(value);

      if (+value > +tokenBalanceMap?.[token0.symbol!].displayBalance!) {
        setToken0Error(true);
      } else {
        setToken0Error(false);
      }
    }
  };

  const handleToken1Input = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setToken1Amount(value);

      if (+value > +tokenBalanceMap?.[token1.symbol!].displayBalance!) {
        setToken1Error(true);
      } else {
        setToken1Error(false);
      }
    }
  };

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
    const token0AmountWei = toWei(token0Amount, token0.decimals);
    const token1AmountWei = toWei(token1Amount, token1.decimals);

    const addLiquidityABI = find(IUniswapV2Router.abi, { name: "addLiquidityETH" });
    const addLiquidityMethod = connex.thor.account(ROUTER_ADDRESS).method(addLiquidityABI).value(token0AmountWei);
    if (token0.symbol === "VET" || token1.symbol === "VET") {
      // TODO: Add slippage tolerance
      const addLiquidityArugments =
        token0.symbol === "VET"
          ? [
              token1.address,
              token1AmountWei,
              token1AmountWei,
              token0AmountWei,
              account,
              Math.ceil(Date.now() / 1000) + 60 * 20
            ]
          : [
              token0.address,
              token0AmountWei,
              token0AmountWei,
              token1AmountWei,
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
      // TODO: addLiquidty without ETH token
    }

    // TODO: estimate gas, on error return
    // connex.thor
    //   .account(ROUTER_ADDRESS)
    //   .method(addLiquidityABI)
    //   .value(token0AmountWei)
    //   .call(...addLiquidityArugments)
    //   .then((res: any) => {
    //     console.log(res.data);
    //   });
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
            <div className={css.tokenTrigger__icon}></div>
            <div className={css.tokenTrigger__name}>{token0.symbol}</div>
          </button>
          <TextField className={clsx(css.tokenInput__bottom, token0Error && css.error)} aria-label="Token amount">
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
            <div className={css.tokenTrigger__icon}></div>
            <div className={css.tokenTrigger__name}>{token1.symbol}</div>
          </button>
          <TextField className={clsx(css.tokenInput__bottom, token1Error && css.error)} aria-label="Token amount">
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
        <div>
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
              token0Error ||
              token1Error
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

  const fromToken = pair.token0;
  const toToken = pair.token1;

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
          <DataEntry title={fromToken.symbol!}>0.00</DataEntry>
          <DataEntry title={toToken.symbol!}>0.00</DataEntry>
        </section>
      </Card>
      <Button>Remove</Button>
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
