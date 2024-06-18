import { clsx } from "clsx";
import css from "./Table.module.scss";

type TableProps = {
  className?: string;
  children?: React.ReactNode;
};

export default function Table({ className, children }: TableProps) {
  return (
    <div className={css.tableWrapper}>
      <table className={clsx(css.Table, className)}>{children}</table>
    </div>
  );
}
