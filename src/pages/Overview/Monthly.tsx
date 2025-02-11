import BigNumber from "bignumber.js";
import Table from "~/components/Table";
import { tradingStatistics } from "~/data/pointsV3";
import css from "./Overview.module.scss";

export default function Monthly() {
  return (
    <div className={css.page}>
      <section className={css.section}>
        <h2 className={css.section__heading}>SWAP Statistics</h2>
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>SWAP Volume</th>
              <th>SWAP Transactions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(tradingStatistics.monthlyStats)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, value]) => (
                <tr key={month}>
                  <td>
                    {new Date(month).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long"
                    })}
                  </td>
                  <td>{BigNumber(value.volume).toFormat(2)} VET</td>
                  <td>{BigNumber(value.transactions).toFormat()}</td>
                </tr>
              ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
