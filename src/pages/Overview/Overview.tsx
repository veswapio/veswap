import { useMemo } from "react";
// import { Link } from "react-router-dom";
// import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import BigNumber from "bignumber.js";
import { useWallet } from "@vechain/dapp-kit-react";
import useAllPairList from "~/hooks/useAllPairList";
import useTokenPrice from "~/hooks/useTokenPrice";
import useVoter from "~/hooks/useVoter";
// import useVoter, { calcRound } from "~/hooks/useVoter";
import { useOverviewData } from "~/hooks/useOverviewData";
import { formatBigNumber, truncateAddress } from "~/utils/helpers";
import tokens from "~/constants/tokens";
import TOKEN_ICONS from "~/constants/tokenIcons";
import Table from "~/components/Table";
import { tradingStatistics } from "~/data/pointsV4";
import css from "./Overview.module.scss";

import IconArrow2 from "~/assets/arrow2.svg?react";
// import IconPlus from "~/assets/plus.svg?react";
// import IconExternal from "~/assets/external.svg?react";

function getCurrentDateFormatted() {
  const date = new Date();
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function Overview() {
  const { account } = useWallet();

  const { data: allPairList } = useAllPairList();
  const { data: tokenPrice } = useTokenPrice();
  const { data: overviewData } = useOverviewData();
  const { data: voterData } = useVoter(account);

  const lastWeekDates = useMemo(() => {
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    };

    return {
      start: formatDate(lastMonday),
      end: formatDate(lastSunday)
    };
  }, []);

  const _overview = useMemo(() => {
    if (!tokenPrice || !overviewData) return null;
    const totalVolume = overviewData.totalVolume
      .reduce((a: BigNumber, c: any) => {
        return a.plus(c.volume0.times(tokenPrice[c.token0])).plus(c.volume1.times(tokenPrice[c.token1]));
      }, BigNumber(0))
      .toFormat(2);
    const todayVolume = Object.entries(overviewData.todayVolume)
      .reduce((a: BigNumber, c: any) => a.plus(BigNumber(tokenPrice[c[0]]).times(c[1])), BigNumber(0))
      .toFormat(2);

    const { traders } = overviewData;

    return {
      totalVolume,
      todayVolume,
      traders
    };
  }, [overviewData, tokenPrice]);

  const _data = useMemo(() => {
    if (!tokenPrice || !allPairList) return null;

    const pairList = allPairList.map((pair: any, idx: number) => {
      const token0 = tokens.find((token) => token.address.toLowerCase() === pair.token0Address.toLowerCase())!;
      const token1 = tokens.find((token) => token.address.toLowerCase() === pair.token1Address.toLowerCase())!;

      const token0Price = tokenPrice[token0.symbol!];
      const token1Price = tokenPrice[token1.symbol!];

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
            <div className={css.overviewCard__value}>{_data ? `$${_data.totalTVL}` : "-"}</div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>Total Volume ({getCurrentDateFormatted()})</div>
            <div className={css.overviewCard__value}>{_overview ? `$${_overview.totalVolume}` : "-"}</div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>Total SWAP Volume ({lastWeekDates.end})</div>
            <div className={css.overviewCard__value}>
              {BigNumber(tradingStatistics.totalSwapVolume).toFormat(2)} VET
            </div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>Total SWAP Transactions ({lastWeekDates.end})</div>
            <div className={css.overviewCard__value}>
              {BigNumber(tradingStatistics.totalSwapTransactions).toFormat()}
            </div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>Traders: ({lastWeekDates.end})</div>
            <div className={css.overviewCard__value}>{BigNumber(tradingStatistics.uniqueTraders).toFormat()}</div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>Volume Today ({getCurrentDateFormatted()})</div>
            <div className={css.overviewCard__value}>{_overview ? `$${_overview.todayVolume}` : "-"}</div>
          </div>
        </div>
      </section>

      <section className={css.section}>
        <h2 className={css.section__heading}>VeBetterDAO</h2>

        {voterData?.hasVoted ? (
          <div className={css.vote}>
            <p className={css.vote__text}>You have voted on VeBetterDAO.</p>
            <button className={css.vote__button}>
              <span>Cast more votes</span>
            </button>
            {/* <a
            className={css.vote__button}
            href={`https://governance.vebetterdao.org/rounds/${calcRound()}`}
            target="_blank"
            rel="noreferrer"
            >
             Cast more votes
             </a> */}
          </div>
        ) : (
          <div className={css.vote}>
            <p className={css.vote__text}>You haven&apos;t voted on VeBetterDAO yet.</p>
            <button className={css.vote__button}>
              <span>Go to vote</span>
            </button>
            {/* <a
            className={css.vote__button}
            href={`https://governance.vebetterdao.org/rounds/${calcRound()}`}
            target="_blank"
            rel="noreferrer"
            >
             Go to vote
             </a> */}
          </div>
        )}
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
              <th>Account</th>
              <th>Token Amount</th>
              <th></th>
              <th>Token Amount</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {overviewData?.swapList.map((record: any) => (
              <tr key={record.id}>
                <td>Swap</td>
                <td>
                  {/* <a href="" className={css.link}> */}
                  {truncateAddress(record.from)}
                  {/* </a> */}
                </td>
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}>{TOKEN_ICONS[record.fromToken.symbol]}</div>
                  </div>
                  {formatBigNumber(record.amountIn, 4)}
                </td>
                <td>
                  <IconArrow2 className={css.iconArrow} />
                </td>
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}>{TOKEN_ICONS[record.toToken.symbol]}</div>
                  </div>
                  {formatBigNumber(record.amountOut, 4)}
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
