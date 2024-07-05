import { useMemo } from "react";
import { Link } from "react-router-dom";
// import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import BigNumber from "bignumber.js";
import Table from "~/components/Table";
import useAllPairList from "~/hooks/useAllPairList";
import useTokenPrice from "~/hooks/useTokenPrice";
import { useSwapRecords, useOverviewData } from "~/hooks/useOverviewData";
import { fixedBigNumber } from "~/utils/helpers";
import tokens from "~/constants/tokens";
import TOKEN_ICONS from "~/constants/tokenIcons";
import css from "./Overview.module.scss";

import IconArrow2 from "~/assets/arrow2.svg?react";
// import IconPlus from "~/assets/plus.svg?react";
// import IconExternal from "~/assets/external.svg?react";

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
  const { data: swapRecords } = useSwapRecords();
  const { data: overviewData } = useOverviewData();

  const _totalVolume = useMemo(() => {
    if (!tokenPrice || !overviewData) return null;
    return fixedBigNumber(
      overviewData.totalVolume.reduce((a: BigNumber, c: any) => {
        // console.log(
        //   c.volume0.times(tokenPrice[c.token0 as "VET" | "VTHO"]).toString(),
        //   c.volume1.times(tokenPrice[c.token1 as "VET" | "VTHO"]).toString()
        // );
        return a
          .plus(c.volume0.times(tokenPrice[c.token0 as "VET" | "VTHO"]))
          .plus(c.volume1.times(tokenPrice[c.token1 as "VET" | "VTHO"]));
      }, BigNumber(0)),
      2
    );
  }, [overviewData, tokenPrice]);

  const _data = useMemo(() => {
    if (!tokenPrice || !allPairList) return null;

    const pairList = allPairList.map((pair: any, idx: number) => {
      const token0 = tokens.find((token) => token.address.toLowerCase() === pair.token0Address.toLowerCase())!;
      const token1 = tokens.find((token) => token.address.toLowerCase() === pair.token1Address.toLowerCase())!;

      const token0Price = tokenPrice[token0.symbol as "VET" | "VTHO"];
      const token1Price = tokenPrice[token1.symbol as "VET" | "VTHO"];

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
            <div className={css.overviewCard__value}>${_totalVolume}</div>
          </div>
        </div>
        <div className={css.overviewStatus}>
          <div className={css.status}>
            <div className={css.status__title}>Traders:</div>
            <div className={css.status__value}>-</div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>LPs:</div>
            <div className={css.status__value}>{_data?.totalLP}</div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>Volume Today:</div>
            <div className={css.status__value}>-</div>
          </div>
        </div>
      </section>

      <section className={css.section}>
        <h2 className={css.section__heading}>
          Top Pools
          {/* <Link className={css.viewMore} to="/pools">
          View More
          </Link> */}
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
                <td>-</td>
                <td>-</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section className={css.section}>
        <h2 className={css.section__heading}>Transactions</h2>
        <Table>
          <thead>
            <tr>
              <th>Actions</th>
              {/* <th>Account</th> */}
              <th>Token Amount</th>
              <th></th>
              <th>Token Amount</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {swapRecords?.map((record: any) => (
              <tr key={record.id}>
                <td>Swap</td>
                {/* <td>
                  <a href="" className={css.link}>
                    {record.account}
                  </a>
                </td> */}
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}>{TOKEN_ICONS[record.fromToken.symbol]}</div>
                  </div>
                  {record.amountIn}
                </td>
                <td>
                  <IconArrow2 className={css.iconArrow} />
                </td>
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}>{TOKEN_ICONS[record.toToken.symbol]}</div>
                  </div>
                  {record.amountOut}
                </td>
                <td>{record.date}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {/*<Tabs>
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
            {swapRecords?.map((record: any) => (
            <tr key={record.id}>
            <td>Swap</td>
            <td>
            <a href="" className={css.link}>
            {record.account}
            </a>
            </td>
            <td>
            <div className={css.tokens}>
            <div className={css.token}>{TOKEN_ICONS[record.fromToken.symbol]}</div>
            </div>
            {record.amountIn}
            </td>
            <td>
            <IconArrow2 className={css.iconArrow} />
            </td>
            <td>
            <div className={css.tokens}>
            <div className={css.token}>{TOKEN_ICONS[record.toToken.symbol]}</div>
            </div>
            {record.amountOut}
            </td>
            <td>{record.date}</td>
            </tr>
            ))}
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
    </Tabs>*/}
      </section>
    </div>
  );
}
