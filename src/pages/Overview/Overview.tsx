import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import BigNumber from "bignumber.js";
import Table from "~/components/Table";
import useAllPairList from "~/hooks/useAllPairList";
import useTokenPrice from "~/hooks/useTokenPrice";
import useOverviewData from "~/hooks/useOverviewData";
import tokens from "~/constants/tokens";
import css from "./Overview.module.scss";

import IconArrow2 from "~/assets/arrow2.svg?react";
import IconPlus from "~/assets/plus.svg?react";
import IconExternal from "~/assets/external.svg?react";
import TokenIconVet from "~/assets/tokens/vet.svg?react";
import TokenIconVtho from "~/assets/tokens/vtho.svg?react";

const TOKEN_ICONS: { [key: string]: any } = {
  VET: <TokenIconVet />,
  VTHO: <TokenIconVtho />
};

function getCurrentDateFormatted() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export default function Overview() {
  const { data: allPairList } = useAllPairList();
  const { data: tokenPrice } = useTokenPrice();
  const { data: overviewData } = useOverviewData();

  console.log(overviewData);

  const _data = useMemo(() => {
    if (!tokenPrice || !allPairList) return null;

    const pairList = allPairList.map((pair: any, idx: number) => {
      const token0 = tokens.find((token) => token.address.toLowerCase() === pair.token0Address.toLowerCase())!;
      const token1 = tokens.find((token) => token.address.toLowerCase() === pair.token1Address.toLowerCase())!;

      const token0Price = tokenPrice[token0.symbol!.toLowerCase() as "vet" | "vtho"];
      const token1Price = tokenPrice[token1.symbol!.toLowerCase() as "vet" | "vtho"];

      const token0Amount = new BigNumber(pair.reserve0).div(10 ** token0.decimals).times(token0Price);
      const token1Amount = new BigNumber(pair.reserve1).div(10 ** token1.decimals).times(token1Price);

      const tvl = token0Amount.plus(token1Amount);
      const displayTVL = tvl.toFormat(2);
      const lpSupply = new BigNumber(pair.lpTotalSupply).div(10 ** 18);

      return {
        id: idx + 1,
        token0,
        token1,
        tvl,
        displayTVL,
        lpSupply
      };
    });

    return {
      pairList,
      totalTVL: pairList.reduce((acc: BigNumber, pair: any) => acc.plus(pair.tvl), new BigNumber(0)).toFormat(2),
      totalLP: pairList.reduce((acc: BigNumber, pair: any) => acc.plus(pair.lpSupply), new BigNumber(0)).toFormat(2)
    };
  }, [allPairList, tokenPrice]);

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>Overview</h2>
        <div className={css.overviewGroup}>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>TVL ({getCurrentDateFormatted()})</div>
            <div className={css.overviewCard__value}>${_data?.totalTVL}</div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>Volume ({getCurrentDateFormatted()})</div>
            <div className={css.overviewCard__value}>0</div>
          </div>
        </div>
        <div className={css.overviewStatus}>
          <div className={css.status}>
            <div className={css.status__title}>Traders:</div>
            <div className={css.status__value}>0</div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>LPs:</div>
            <div className={css.status__value}>{_data?.totalLP}</div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>Volume Today:</div>
            <div className={css.status__value}>0</div>
          </div>
        </div>
      </section>

      <section className={css.section}>
        <h2 className={css.section__heading}>
          Top Pools
          <Link className={css.viewMore} to="/pools">
            View More
          </Link>
        </h2>
        <Table>
          <thead>
            <tr>
              <th>#</th>
              <th>Pool</th>
              <th>TVL</th>
              <th>APY 7D</th>
              <th>Volume 7D</th>
            </tr>
          </thead>
          <tbody>
            {_data?.pairList.map((i: any) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}>{TOKEN_ICONS[i.token0.symbol]}</div>
                    <div className={css.token}>{TOKEN_ICONS[i.token1.symbol]}</div>
                  </div>
                  {i.token0.symbol} / {i.token1.symbol}
                </td>
                <td>${i.displayTVL}</td>
                <td>0</td>
                <td>0</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      {/* <section className={css.section}>
      <h2 className={css.section__heading}>Transactions</h2>
      <Tabs>
      <TabList className={css.tabList} aria-label="Transactions Tabs">
      <Tab className={css.tabButton} id="Swaps">
      Swaps
      </Tab>
      <Tab className={css.tabButton} id="Liquidity">
      Liquidity
      </Tab>
      </TabList>
      <TabPanel id="Swaps">
      <Table>
      <thead>
      <tr>
      <th>Actions</th>
      <th>Account</th>
      <th>Token Amount</th>
      <th></th>
      <th>Token Amount</th>
      <th>Time</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td>Swap</td>
      <td>
      <a href="" className={css.link}>
      0xabcd...1234
      </a>
      </td>
      <td>
      <div className={css.tokens}>
      <div className={css.token}></div>
      </div>
      0
      </td>
      <td>
      <IconArrow2 className={css.iconArrow} />
      </td>
      <td>
      <div className={css.tokens}>
      <div className={css.token}></div>
      </div>
      0
      </td>
      <td>
      10 mins ago
      <a href="">
      <IconExternal className={css.iconExternal} />
      </a>
      </td>
      </tr>
      </tbody>
      </Table>
      </TabPanel>
      <TabPanel id="Liquidity">
      <Table>
      <thead>
      <tr>
      <th>Actions</th>
      <th>Account</th>
      <th>Token Amount</th>
      <th></th>
      <th>Token Amount</th>
      <th>Time</th>
      </tr>
      </thead>
      <tbody>
      <tr>
      <td>Add</td>
      <td>
      <a href="" className={css.link}>
      0xabcd...1234
      </a>
      </td>
      <td>
      <div className={css.tokens}>
      <div className={css.token}></div>
      </div>
      0
      </td>
      <td>
      <IconPlus className={css.iconPlus} />
      </td>
      <td>
      <div className={css.tokens}>
      <div className={css.token}></div>
      </div>
      0
      </td>
      <td>
      10 mins ago
      <a href="">
      <IconExternal className={css.iconExternal} />
      </a>
      </td>
      </tr>
      </tbody>
      </Table>
      </TabPanel>
      </Tabs>
      </section> */}
    </div>
  );
}
