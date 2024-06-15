import { useEffect, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useWallet, useWalletModal, useConnex } from "@vechain/dapp-kit-react";
import css from "./PageLayout.module.scss";

import IconLogo from "~/assets/logo.svg?react";
import IconBlock from "~/assets/block.svg?react";
import IconChain from "~/assets/chain.svg?react";

export default function Home() {
  const { account } = useWallet();
  const { open, onConnectionStatusChange } = useWalletModal();
  const [buttonText, setButtonText] = useState("Connect Wallet");
  const [blockNumber, setBlockNumber] = useState("-");
  const connex = useConnex();

  useEffect(() => {
    const id = setInterval(() => {
      const blockNumber = connex.thor.status.head.number;
      if (blockNumber) {
        setBlockNumber(blockNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
      }
    }, 1000);

    return () => clearInterval(id);
  }, [connex]);

  useEffect(() => {
    const handleConnected = (address: string | null) => {
      if (address) {
        const formattedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
        setButtonText(`Disconnect from ${formattedAddress}`);
      } else {
        setButtonText("Connect Wallet");
      }
    };

    handleConnected(account);

    onConnectionStatusChange(handleConnected);
  }, [account, onConnectionStatusChange]);

  return (
    <div className={css.root}>
      <nav className={css.nav}>
        <IconLogo className={css.nav__logo} />
        <NavLink to="/swap" className={css.nav__link}>
          Swap
        </NavLink>
        <NavLink to="/overview" className={css.nav__link}>
          Overview
        </NavLink>
        <NavLink to="/pools" className={css.nav__link}>
          Pools
        </NavLink>
        {/*<NavLink to="/search" className={css.nav__link}>
        Search
        </NavLink>*/}
        <button className={css.nav__wallet} onClick={open}>
          {buttonText}
        </button>
      </nav>

      <Outlet />

      <div className={css.status}>
        <IconBlock className={css.status__icon} />
        <span>{blockNumber}</span>
        <IconChain className={css.status__icon} />
        <span>Main</span>
        <span className={css.status__version}>Version: {__COMMIT_HASH__}</span>
      </div>
    </div>
  );
}
