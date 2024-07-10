import { useMemo } from "react";
import BigNumber from "bignumber.js";
import Table from "~/components/Table";
import useAllPairList from "~/hooks/useAllPairList";
import useTokenPrice from "~/hooks/useTokenPrice";
import { useSwapRecords, useOverviewData } from "~/hooks/useOverviewData";
import { fixedBigNumber } from "~/utils/helpers";
import tokens from "~/constants/tokens";
import css from "./Leaderboard.module.scss";

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
        <h2 className={css.section__heading}>LeaderBoard</h2>
        <div>
          <p className={css.status__title}>Points are calculated according to the following rules:</p>
          <p className={css.status__title}>1. For every 1,000 VET of equivalent LP volume provided for 12 hours, 1 point will be counted.</p>
          <p className={css.status__title}>2. For every 100,000 VET of trading volume, 1 point will be counted.</p>
        </div>
      </section>


      {/* TODO: Show top 10 & Show All */}
      <section className={css.section}>
        <h2 className={css.section__heading}>
          Top Contributors
        </h2>
        <Table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Address</th>
              <th className={css.point}>Points Earned</th>
            </tr>
          </thead>
          <tbody>
            {/* TODO: Data */}
            {_data?.pairList.map((i: any) => (
              <tr key={i.id}>
                <td>{i.id}</td>
                <td></td>
                <td className={css.point}></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
