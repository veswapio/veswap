import Table from "~/components/Table";
import css from "./Leaderboard.module.scss";
import { accumulatedData } from "~/data/period1";

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
        <p className={css.section__subheading}>* Points are updated every week</p>
        <Table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Address</th>
              <th className={css.point}>Points Earned</th>
            </tr>
          </thead>
          {accumulatedData.map((item, index) => (
            <tbody key={item[0]}>
              <tr key="-">
                <td>{index + 1}</td>
                <td>{item[0]}</td>
                <td className={css.point}>{(item[1])}</td>
              </tr>
            </tbody>
          ))}
        </Table>
      </section>
    </div>
  );
}
