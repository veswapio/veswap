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
import { toWei } from "~/utils/helpers";
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

  const tokenList = useMemo(() => {
    return tokens.filter((i: any) => i.symbol !== fromToken.symbol && i.symbol !== toToken.symbol);
  }, [fromToken.symbol, toToken.symbol]);

  const handleSwap = () => {
    const _fromToken = fromToken;
    setFromToken(toToken);
    setToToken(_fromToken);
  };

  useEffect(() => {
    async function fetchData() {
      const tokenA = new sdk.Token(1, fromToken.address, fromToken.decimals, fromToken.symbol);
      const tokenB = new sdk.Token(1, toToken.address, toToken.decimals, toToken.symbol);

      const pairData = await sdk.Fetcher.fetchPairData(tokenA, tokenB, connex);
      console.log(pairData);
    }

    fetchData();
  }, [fromToken, toToken, connex]);

  return (
    <div className={css.swapPanel}>
      <Card className={css.card}>
        <TokenInput
          label="From"
          token={fromToken}
          amount={fromTokenAmount}
          onAmountChange={setFromTokenAmount}
          onTokenChange={setFromToken}
          tokenList={tokenList}
        />
        <button className={css.swapButton} onClick={handleSwap}>
          <IconSwap />
        </button>
        <TokenInput
          label="To"
          token={toToken}
          amount={toTokenAmount}
          onAmountChange={setToTokenAmount}
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
        <DataEntry title="Price">VTHO per VET</DataEntry>
        <DataEntry title="Route">VTHO &gt; VET</DataEntry>
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
      {account ? <Button>Swap</Button> : <Button onPress={open}>Connect Wallet</Button>}
    </div>
  );
}

function PoolListPane({ setActivePane }: { setActivePane: (name: string) => void }) {
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

        <div className={css.pool} onClick={handlePoolClick}>
          <div className={css.pool__tokens}>
            <div className={css.pool__token}></div>
            <div className={css.pool__token}></div>
          </div>
          <div className={css.pool__name}>VET / VTHO</div>
          <div className={css.pool__value}>18,758,639 / 1,739,424</div>
        </div>

        <div className={css.card__help}>
          <a href="">Need help? View the user&apos;s guide</a>
        </div>
      </Card>
      {!account && <Button onPress={open}>Connect Wallet</Button>}
    </div>
  );
}

function PoolDetailPane({ setActivePane }: { setActivePane: (name: string) => void }) {
  const { open } = useWalletModal();
  const { account } = useWallet();

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
            <a href="">
              <IconLink /> 0x29a9...5ed3
            </a>
          </DataEntry>
        </section>
        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>
            My Holdings
            <a href="">
              <IconLink /> View Activties
            </a>
          </h3>
          <DataEntry title="VTHO">0</DataEntry>
          <DataEntry title="VET">0</DataEntry>
          <DataEntry title="My pool share">0%</DataEntry>
        </section>
        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>Pool Status</h3>
          <DataEntry title="VTHO">18,792,243.123</DataEntry>
          <DataEntry title="VET">1,734,823.123</DataEntry>
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

function AddLiquidityPane({
  fromToken,
  toToken,
  setActivePane
}: {
  fromToken: sdk.Token;
  toToken: sdk.Token;
  setActivePane: (name: string) => void;
}) {
  const { open } = useWalletModal();
  const { account } = useWallet();
  const { data: tokenBalanceMap } = useTokenBalanceList();
  const connex = useConnex();

  const [fromTokenAmount, setFromTokenAmount] = useState("0");
  const [toTokenAmount, setToTokenAmount] = useState("0");

  const [fromTokenError, setFromTokenError] = useState(false);
  const [toTokenError, setToTokenError] = useState(false);

  const handleFromTokenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setFromTokenAmount(value);

      if (+value > +tokenBalanceMap?.[fromToken.symbol!].displayBalance!) {
        setFromTokenError(true);
      } else {
        setFromTokenError(false);
      }
    }
  };

  const handleToTokenInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d*$/.test(value)) {
      setToTokenAmount(value);

      if (+value > +tokenBalanceMap?.[toToken.symbol!].displayBalance!) {
        setToTokenError(true);
      } else {
        setToTokenError(false);
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

  const handleApprove = async () => {
    const VTHO_ADDRESS = toToken.address;
    const approveMethod = connex.thor.account(VTHO_ADDRESS).method(find(ABI_ERC20, { name: "approve" }));
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
    const fromTokenAmountWei = toWei(fromTokenAmount, fromToken.decimals);
    const toTokenAmountWei = toWei(toTokenAmount, toToken.decimals);

    const addLiquidityABI = find(IUniswapV2Router.abi, { name: "addLiquidityETH" });
    const addLiquidityMethod = connex.thor.account(ROUTER_ADDRESS).method(addLiquidityABI).value(fromTokenAmountWei);

    // TODO: Add slippage tolerance
    const addLiquidityArugments = [
      toToken.address,
      toTokenAmountWei,
      toTokenAmountWei,
      fromTokenAmountWei,
      account,
      Math.ceil(Date.now() / 1000) + 60 * 20
    ];

    // TODO: can not detect error
    // connex.thor
    //   .account(ROUTER_ADDRESS)
    //   .method(addLiquidityABI)
    //   .value(fromTokenAmountWei)
    //   .call(...addLiquidityArugments)
    //   .then((res: any) => {
    //     console.log(res.data);
    //   });

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
            <div className={css.tokenTrigger__name}>{fromToken.symbol}</div>
          </button>
          <TextField
            className={clsx(css.tokenInput__bottom, fromTokenError && css.error)}
            aria-label="From token amount"
          >
            <Input
              className={css.tokenInput__input}
              value={fromTokenAmount}
              onChange={handleFromTokenInput}
              onBlur={() => (fromTokenAmount === "" || fromTokenAmount === ".") && setFromTokenAmount("0")}
              onFocus={() => fromTokenAmount === "0" && setFromTokenAmount("")}
            />
            <div className={css.tokenInput__balance}>
              Balance: {tokenBalanceMap?.[fromToken.symbol!].displayBalance || "0"}
            </div>
          </TextField>
        </div>

        <IconPlus className={css.liquidityPlus} />

        <div className={css.liquidityInput}>
          <button className={clsx(css.tokenTrigger, css.disabled)} tabIndex={-1}>
            <div className={css.tokenTrigger__icon}></div>
            <div className={css.tokenTrigger__name}>{toToken.symbol}</div>
          </button>
          <TextField className={clsx(css.tokenInput__bottom, toTokenError && css.error)} aria-label="To token amount">
            <Input
              className={css.tokenInput__input}
              value={toTokenAmount}
              onChange={handleToTokenInput}
              onBlur={() => (toTokenAmount === "" || toTokenAmount === ".") && setToTokenAmount("0")}
              onFocus={() => toTokenAmount === "0" && setToTokenAmount("")}
            />
            <div className={css.tokenInput__balance}>
              Balance: {tokenBalanceMap?.[toToken.symbol!].displayBalance || "0"}
            </div>
          </TextField>
        </div>
      </Card>
      {account ? (
        <div>
          {tokenBalanceMap?.VTHO.allowance !== 0n ? (
            <Button
              onPress={handleAddLiquidity}
              disabled={
                !fromTokenAmount ||
                !toTokenAmount ||
                fromTokenAmount === "0" ||
                toTokenAmount === "0" ||
                fromTokenError ||
                toTokenError
              }
            >
              Add Liquidity
            </Button>
          ) : (
            <Button onPress={handleApprove}>Approve VTHO</Button>
          )}
        </div>
      ) : (
        <Button onPress={open}>Connect Wallet</Button>
      )}
    </div>
  );
}

function RemoveLiquidityPane({ setActivePane }: { setActivePane: (name: string) => void }) {
  return (
    <div className={css.poolPanel}>
      <Card className={css.card}>
        <h2 className={css.card__poolHeading}>
          <button className={css.card__poolBackButton} onClick={() => setActivePane("POOL")}>
            <IconArrow2 />
          </button>
          Remove Liquidity
        </h2>

        <Slider className={css.slider} defaultValue={30} aria-label="Remove liquidity percentage">
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

        <section className={css.poolSection}>
          <h3 className={css.poolSection__heading}>You will receive</h3>
          <DataEntry title="VTHO">0.00</DataEntry>
          <DataEntry title="VET">0.00</DataEntry>
        </section>
      </Card>
      <Button>Remove</Button>
    </div>
  );
}

function PoolPanel() {
  const [activePane, setActivePane] = useState("");

  if (activePane === "POOL") {
    return <PoolDetailPane setActivePane={setActivePane} />;
  }

  if (activePane === "ADD_LIQUIDITY") {
    return <AddLiquidityPane fromToken={tokens[0]} toToken={tokens[1]} setActivePane={setActivePane} />;
  }

  if (activePane === "REMOVE_LIQUIDITY") {
    return <RemoveLiquidityPane setActivePane={setActivePane} />;
  }

  return <PoolListPane setActivePane={setActivePane} />;
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
      {account ? <Button>Claim</Button> : <Button onPress={open}>Connect Wallet</Button>}
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
