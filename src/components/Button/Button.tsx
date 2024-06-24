import { clsx } from "clsx";
import { Button as AriaButton } from "react-aria-components";
import css from "./Button.module.scss";

type ButtonProps = {
  className?: string;
  outline?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  small?: boolean;
  children: React.ReactNode;
};

export default function Button({ className, outline, onPress, disabled, small, children }: ButtonProps) {
  return (
    <AriaButton
      onPress={onPress}
      className={clsx(css.Button, outline && css.outline, small && css.small, className)}
      isDisabled={disabled}
    >
      {children}
    </AriaButton>
  );
}
