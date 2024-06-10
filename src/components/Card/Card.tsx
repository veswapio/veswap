import { clsx } from "clsx";
import css from "./Card.module.scss";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ className, children }: CardProps) {
  return <div className={clsx(css.Card, className)}>{children}</div>;
}
