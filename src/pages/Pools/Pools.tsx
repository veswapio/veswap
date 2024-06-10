import Table from "~/components/Table";
import css from "../Overview/Overview.module.scss";

export default function Pools() {
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
            <tr>
              <td>1</td>
              <td>
                <div className={css.tokens}>
                  <div className={css.token}></div>
                  <div className={css.token}></div>
                </div>
                VTHO / VET
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
          </tbody>
        </Table>
      </section>
    </div>
  );
}
