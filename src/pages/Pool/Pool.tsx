import clsx from "clsx";
import { find } from "lodash";
import { useAtom } from "jotai";
import BigNumber from "bignumber.js";
import { useState, useMemo } from "react";
import { useWallet, useWalletModal, useConnex } from "@vechain/dapp-kit-react";
import { TextField, Input, Slider, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components";

import sdk from "~/sdk";
import { queryClient } from "~/query";
import { transactionStatusAtom } from "~/store";
import TOKEN_ICONS from "~/constants/tokenIcons";
import useMyPairShare from "~/hooks/useMyPairShare";
import useTokenBalanceList from "~/hooks/useTokenBalanceList";
import useFeaturedPairList from "~/hooks/useFeaturedPairList";
import { ROUTER_ADDRESS } from "~/constants/addresses";
import IUniswapV2Router from "~/abis/IUniswapV2Router02.json";
import ABI_ERC20 from "~/abis/erc20.json";
import { truncateAddress, formatBigNumber, fixedBigNumber, bigNumberToWei } from "~/utils/helpers";
import poll from "~/utils/poll";

import Card from "~/components/Card";
import Button from "~/components/Button";
import DataEntry from "~/components/DataEntry";
import SearchBox from "~/components/SearchBox";

import css from "./Pool.module.scss";

import IconArrow2 from "~/assets/arrow2.svg?react";
import IconLink from "~/assets/link.svg?react";
import IconPlus from "~/assets/plus.svg?react";

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
        <div className={css.verticalButtonGroup}>
          <Button onPress={() => setActivePane("ADD_LIQUIDITY")}>Add Liquidity</Button>
          <Button outline onPress={() => setActivePane("REMOVE_LIQUIDITY")}>
            Remove Liquidity
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
          <button className="tokenTrigger disabled" tabIndex={-1}>
            <div className="tokenTrigger__icon">{token0.symbol && TOKEN_ICONS[token0.symbol]}</div>
            <div className="tokenTrigger__name">{token0.symbol}</div>
          </button>
          <TextField className={clsx("tokenInput__bottom", _token0Error && "error")} aria-label="Token amount">
            <Input
              className="tokenInput__input"
              value={token0Amount}
              onChange={handleToken0Input}
              onBlur={() => (token0Amount === "" || token0Amount === ".") && setToken0Amount("0")}
              onFocus={() => token0Amount === "0" && setToken0Amount("")}
            />
            <div className="tokenInput__balance">
              Balance: {tokenBalanceMap?.[token0.symbol!].displayBalance || "0"}
            </div>
          </TextField>
        </div>

        <IconPlus className={css.liquidityPlus} />

        <div className={css.liquidityInput}>
          <button className="tokenTrigger disabled" tabIndex={-1}>
            <div className="tokenTrigger__icon">{token1.symbol && TOKEN_ICONS[token1.symbol]}</div>
            <div className="tokenTrigger__name">{token1.symbol}</div>
          </button>
          <TextField className={clsx("tokenInput__bottom", _token0Error && "error")} aria-label="Token amount">
            <Input
              className="tokenInput__input"
              value={token1Amount}
              onChange={handleToken1Input}
              onBlur={() => (token1Amount === "" || token1Amount === ".") && setToken1Amount("0")}
              onFocus={() => token1Amount === "0" && setToken1Amount("")}
            />
            <div className="tokenInput__balance">
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

export default function Pool() {
  const [activePane, setActivePane] = useState("");
  const [activePairIndex, setActivePairIndex] = useState(0);
  const { data: pairList, isPending } = useFeaturedPairList();

  if (isPending) {
    return (
      <div className={css.loadingPanel}>
        <Card className={css.card}>
          <div className="loader" />
        </Card>
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
