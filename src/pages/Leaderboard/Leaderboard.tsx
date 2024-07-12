import Table from "~/components/Table";
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
          <p className={css.status__title}>2. For every 100,000 VET of trading volume, 1 point will be counted.</p>
        </div>
      </section>

      {/* TODO: Show top 10 & Show All */}
      <section className={css.section}>
        <h2 className={css.section__heading}>Top Contributors</h2>
        <Table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Address</th>
              <th className={css.point}>Points Earned</th>
            </tr>
          </thead>
          <tbody>
            <tr key="-">
              <td>1</td>
              <td>-</td>
              <td className={css.point}>-</td>
            </tr>
          </tbody>
        </Table>
      </section>
    </div>
  );
}
