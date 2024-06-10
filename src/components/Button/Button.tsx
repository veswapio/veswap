import { clsx } from "clsx";
import { Button as AriaButton } from "react-aria-components";
import css from "./Button.module.scss";

type ButtonProps = {
  className?: string;
  outline?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
};

export default function Button({ className, outline, onPress, children }: ButtonProps) {
  return (
    <AriaButton onPress={onPress} className={clsx(css.Button, outline && css.outline, className)}>
      {children}
    </AriaButton>
  );
}
