import { Link } from "react-router-dom";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import Table from "~/components/Table";
import useAllPairList from "~/hooks/useAllPairList";
import useTokenPrice from "~/hooks/useTokenPrice";
import css from "./Overview.module.scss";

import IconArrow2 from "~/assets/arrow2.svg?react";
import IconPlus from "~/assets/plus.svg?react";
import IconExternal from "~/assets/external.svg?react";
import TokenIconVet from "~/assets/tokens/vet.svg?react";
import TokenIconVtho from "~/assets/tokens/vtho.svg?react";

const TOKENADDRESS_ICONS: { [key: string]: any } = {
  "0x45429a2255e7248e57fce99e7239aed3f84b7a53": {
    icon: <TokenIconVet />,
    name: "VET",
  },
  "0x0000000000000000000000000000456e65726779": {
    icon: <TokenIconVtho />,
    name: "VTHO"
  }
};

export default function Overview() {
  const { data: allPairList } = useAllPairList();
  const { data: tokenPrice } = useTokenPrice();

  console.log("allPairList: ", allPairList);
  console.log("tokenPrice: ", tokenPrice);

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>Overview</h2>
        <div className={css.overviewGroup}>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>TVL (2024/03/21)</div>
            <div className={css.overviewCard__value}>
              <div className={css.overviewCard__icon}></div> 559.8K
            </div>
          </div>
          <div className={css.overviewCard}>
            <div className={css.overviewCard__title}>TVL (2024/03/21)</div>
            <div className={css.overviewCard__value}>
              <div className={css.overviewCard__icon}></div> 559.8K
            </div>
          </div>
        </div>
        <div className={css.overviewStatus}>
          <div className={css.status}>
            <div className={css.status__title}>Traders:</div>
            <div className={css.status__value}>20.32K</div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>LPs:</div>
            <div className={css.status__value}>8.13K</div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>Volume Today:</div>
            <div className={css.status__value}>2.11K</div>
            <div className={css.status__token}></div>
          </div>
          <div className={css.status}>
            <div className={css.status__title}>Claimed VTHO:</div>
            <div className={css.status__value}>1.3M</div>
            <div className={css.status__token}></div>
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
            {allPairList?.map((pair: any) => (
              <tr key={pair.address}>
                <td>1</td>
                <td>
                  <div className={css.tokenTrigger}>
                    <div className={css.tokenTrigger__icon}>
                      {pair.token0Address && TOKENADDRESS_ICONS[pair.token0Address].icon}
                    </div>
                    <div className={css.tokenTrigger__icon}>
                      {pair.token1Address && TOKENADDRESS_ICONS[pair.token1Address].icon}
                    </div>
                    <div className={css.tokenTrigger__name}>
                      {pair.token0Address && TOKENADDRESS_ICONS[pair.token0Address].name}
                      {" / "}
                      {pair.token1Address && TOKENADDRESS_ICONS[pair.token1Address].name}
                    </div>
                  </div>
                </td>
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}></div>
                  </div>
                  234.8K
                </td>
                <td>12.95%</td>
                <td>
                  <div className={css.tokens}>
                    <div className={css.token}></div>
                  </div>
                  234.8K
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section className={css.section}>
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
                    234.8
                  </td>
                  <td>
                    <IconArrow2 className={css.iconArrow} />
                  </td>
                  <td>
                    <div className={css.tokens}>
                      <div className={css.token}></div>
                    </div>
                    12.98
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
                    234.8
                  </td>
                  <td>
                    <IconPlus className={css.iconPlus} />
                  </td>
                  <td>
                    <div className={css.tokens}>
                      <div className={css.token}></div>
                    </div>
                    12.98
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
      </section>
    </div>
  );
}
