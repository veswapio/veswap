import { clsx } from "clsx";
import { SearchField, Input } from "react-aria-components";
import css from "./SearchBox.module.scss";

import IconSearch from "~/assets/search.svg?react";

type SearchBoxProps = {
  className?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

export default function SearchBox({ className, placeholder, value, onChange }: SearchBoxProps) {
  return (
    <SearchField className={clsx(css.SearchBox, className)} aria-label={placeholder}>
      <IconSearch className={css.SearchBox__icon} />
      <Input
        className={css.SearchBox__input}
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </SearchField>
  );
}
