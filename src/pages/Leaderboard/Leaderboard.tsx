import { useMemo } from "react";
import { useWallet } from "@vechain/dapp-kit-react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import Table from "~/components/Table";
import { totalPoints, weeklyPoints, pointsLog } from "~/data/pointsV3";
import css from "./Leaderboard.module.scss";

export default function Leaderboard() {
  const { account } = useWallet();

  const lastWeekDates = useMemo(() => {
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    };

    return {
      start: formatDate(lastMonday),
      end: formatDate(lastSunday)
    };
  }, []);

  const myPoints = useMemo(() => {
    if (!account) return [];
    return pointsLog[account.toLowerCase()] || [];
  }, [account]);

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>LeaderBoard</h2>
        <div>
          <h4 className={css.status__title}>Point Calculation Rules:</h4>
          <h5 className={css.status__subTitle}>For Trading:</h5>
          <ul>
            <li>Trade 10,000 $VET to earn 1 VeSwap Point.</li>
            <li>Max 4 points per day.</li>
          </ul>
          <h5 className={css.status__subTitle}>For Providing Liquidity:</h5>
          <ul>
            <li>Provide 100,000 $VET liquidity for 24 hrs x 7 days = 14 points.</li>
            <li>Max 140 points per week (Liquidity duration should be continuous for 7 days).</li>{" "}
          </ul>
        </div>
      </section>

      <section className={css.section}>
        <h2 className={css.section__heading}>Top Contributors</h2>
        <Tabs>
          <TabList className={css.tabList} aria-label="Transactions Tabs">
            <Tab className={css.tabButton} id="total">
              Cumulative Points
            </Tab>
            <Tab className={css.tabButton} id="weekly">
              Points This Week
            </Tab>
            <Tab className={css.tabButton} id="mine">
              My Points
            </Tab>
          </TabList>
          <TabPanel id="total">
            <p className={css.section__subheading}>* Last updated on {lastWeekDates.end}</p>
            <Table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Address</th>
                  <th className={css.point}>Points Earned</th>
                </tr>
              </thead>
              <tbody>
                {totalPoints.map((item, index) => (
                  <tr key={item.account}>
                    <td className={css.mono}>{index + 1}</td>
                    <td className={css.mono}>{item.account}</td>
                    <td className={css.point}>{item.points}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TabPanel>
          <TabPanel id="weekly">
            <p className={css.section__subheading}>
              * Data from {lastWeekDates.start} through {lastWeekDates.end}
            </p>
            <Table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Address</th>
                  <th className={css.point}>Points Earned</th>
                </tr>
              </thead>
              <tbody>
                {weeklyPoints.map((item, index) => (
                  <tr key={item.account}>
                    <td className={css.mono}>{index + 1}</td>
                    <td className={css.mono}>{item.account}</td>
                    <td className={css.point}>{item.points}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TabPanel>
          <TabPanel id="mine">
            <p className={css.section__subheading}>* Last updated on {lastWeekDates.end}</p>
            {!!myPoints.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Round</th>
                    <th className={css.point}>Liquidity Points</th>
                    <th className={css.point}>SWAP Points</th>
                    <th className={css.point}>Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {myPoints.map((item: any) => (
                    <tr key={item.weekIndex}>
                      <td className={css.mono}>Round #{item.weekIndex}</td>
                      <td className={css.point}>{item.liquidityPoints}</td>
                      <td className={css.point}>{item.swapPoints}</td>
                      <td className={css.point}>{item.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className={css.section__subheading}>
                {!!account ? "No point records for this account." : "No wallet connected."}
              </p>
            )}
          </TabPanel>
        </Tabs>
      </section>
    </div>
  );
}
