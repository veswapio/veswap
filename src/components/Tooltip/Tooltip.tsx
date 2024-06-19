import { clsx } from "clsx";
import { useState } from "react";
import { Button, OverlayArrow, Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";
import css from "./Tooltip.module.scss";

import IconInfo from "~/assets/info.svg?react";

type TooltipProps = {
  className?: string;
  content: string;
};

export default function Tooltip({ className, content }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <TooltipTrigger delay={0} isOpen={show} onOpenChange={setShow}>
      <Button className={clsx(css.TooltipTrigger, className)} onPress={() => setShow(!show)}>
        <IconInfo className={css.TooltipTrigger__icon} />
      </Button>
      <AriaTooltip placement="end" className={css.Tooltip}>
        <OverlayArrow className={css.Tooltip__overlay}>
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path d="M0 0 L4 4 L8 0" />
          </svg>
        </OverlayArrow>
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
