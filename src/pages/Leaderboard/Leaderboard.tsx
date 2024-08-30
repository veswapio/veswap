import { Tabs, TabList, Tab, TabPanel } from "react-aria-components";
import Table from "~/components/Table";
import { totalPoints, weeklyPoints } from "~/data/points";
import css from "./Leaderboard.module.scss";

export default function Leaderboard() {
  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>LeaderBoard</h2>
        <div>
          <p className={css.status__title}>Points are calculated according to the following rules:</p>
          <p className={css.status__title}>
            1. For every 1,000 VET of equivalent LP volume provided for 12 hours, 1 point will be counted.
          </p>
          <p className={css.status__title}>2. For every 50,000 VET of trading volume, 1 point will be counted.</p>
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
                <tbody key={item[0]}>
                  <tr key="-">
                    <td className={css.mono}>{index + 1}</td>
                    <td className={css.mono}>{item[0]}</td>
                    <td className={css.point}>{item[1]}</td>
                  </tr>
                </tbody>
              ))}
            </Table>
          </TabPanel>
          <TabPanel id="weekly">
            <p className={css.section__subheading}>* Data from August 19 through August 25, 2024</p>
            <Table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Address</th>
                  <th className={css.point}>Points Earned</th>
                </tr>
              </thead>
              {weeklyPoints.map((item, index) => (
                <tbody key={item[0]}>
                  <tr key="-">
                    <td className={css.mono}>{index + 1}</td>
                    <td className={css.mono}>
                      {item[0]}
                      {!!item[2] && <span className={css.doubleIndicator}>VOTED</span>}
                      {!!item[2] && <span className={css.doubleIndicator}>x2</span>}
                    </td>
                    <td className={css.point}>{item[1]}</td>
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
