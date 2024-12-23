import { clsx } from "clsx";
import Tooltip from "../Tooltip";
import css from "./DataEntry.module.scss";

type DataEntryProps = {
  className?: string;
  tooltip?: string;
  title: string;
  children: React.ReactNode;
};

export default function DataEntry({ className, tooltip, title, children }: DataEntryProps) {
  return (
    <div className={clsx(css.DataEntry, className)}>
      <div className={css.DataEntry__title}>{title}</div>
      {tooltip && <Tooltip className={css.DataEntry__icon} content={tooltip} />}
      <div className={css.DataEntry__content}>{children}</div>
    </div>
  );
}
