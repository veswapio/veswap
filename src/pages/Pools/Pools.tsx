import { useMemo } from "react";
import BigNumber from "bignumber.js";
import useAllPairList from "~/hooks/useAllPairList";
import useTokenPrice from "~/hooks/useTokenPrice";
import tokens from "~/constants/tokens";
import Table from "~/components/Table";
import css from "../Overview/Overview.module.scss";

import TokenIconVet from "~/assets/tokens/vet.svg?react";
import TokenIconVtho from "~/assets/tokens/vtho.svg?react";

const TOKEN_ICONS: { [key: string]: any } = {
  VET: <TokenIconVet />,
  VTHO: <TokenIconVtho />
};

export default function Pools() {
  const { data: allPairList } = useAllPairList();
  const { data: tokenPrice } = useTokenPrice();

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
  }, [tokens, allPairList, tokenPrice]);

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>Pools</h2>
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
    </div>
  );
}
