import { useMemo } from "react";
import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import Table from "~/components/Table";
import { totalPoints, weeklyPoints } from "~/data/pointsV3";
import css from "./Leaderboard.module.scss";

export default function Leaderboard() {
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

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>LeaderBoard</h2>
        <div>
          <h4 className={css.status__title}>Point Calculation Rules:</h4>
          <h5 className={css.status__subTitle}>For Trading:</h5>
          <p className={css.status__subTitle}>Trade 10,000 $VET to earn 1 VeSwap Point. Max 4 points per day.</p>
          <h5 className={css.status__subTitle}>For Providing Liqudity:</h5>
          <p className={css.status__subTitle}>
            Provide 1,000 $VET liquidity for 24 hrs x 7 days = 14 points. Max 140 points per week (Liquidity duration
            should be continuous for 7 days).
          </p>
        </div>
      </section>
      {/* TODO: Show top 10 & Show All */}

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
          </TabList>
          <TabPanel id="total">
            <p className={css.section__subheading}>* Points are updated every week</p>
            <Table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Address</th>
                  <th className={css.point}>Points Earned</th>
                </tr>
              </thead>
              {totalPoints.map((item, index) => (
                <tbody key={item.account}>
                  <tr key="-">
                    <td className={css.mono}>{index + 1}</td>
                    <td className={css.mono}>{item.account}</td>
                    <td className={css.point}>{item.points}</td>
                  </tr>
                </tbody>
              ))}
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
              {weeklyPoints.map((item, index) => (
                <tbody key={item.account}>
                  <tr key="-">
                    <td className={css.mono}>{index + 1}</td>
                    <td className={css.mono}>{item.account}</td>
                    <td className={css.point}>{item.points}</td>
                  </tr>
                </tbody>
              ))}
            </Table>
          </TabPanel>
        </Tabs>
      </section>
    </div>
  );
}
