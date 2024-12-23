import clsx from "clsx";
import { Link } from "react-router-dom";
import { Player } from "@lottiefiles/react-lottie-player";
import css from "./LandingPage.module.scss";

import IconLogo from "~/assets/logo.svg?react";
import IconTwitter from "~/assets/twitter.svg?react";
import IconLinktree from "~/assets/linktree.svg?react";
import IconTelegram from "~/assets/telegram.svg?react";
import IconMedium from "~/assets/medium.svg?react";

export default function LandingPage() {
  return (
    <div className={css.page}>
      <Player autoplay loop src="/lottie/spaceship/data.json" className={css.page__spaceship} />
      <Player autoplay loop src="/lottie/star/data.json" className={clsx(css.page__star, css.p1)} />
      <Player autoplay loop src="/lottie/star/data.json" className={clsx(css.page__star, css.p2)} />
      <Player autoplay loop src="/lottie/star/data.json" className={clsx(css.page__star, css.p3)} />
      <Player autoplay loop src="/lottie/star/data.json" className={clsx(css.page__star, css.p4)} />
      <Player autoplay loop src="/lottie/star/data.json" className={clsx(css.page__star, css.p5)} />
      <Player autoplay loop src="/lottie/star/data.json" className={clsx(css.page__star, css.p6)} />

      <nav className={css.nav}>
        <IconLogo className={css.nav__logo} />
        <div className={css.nav__links}>
          <Link to="/overview" className={css.nav__link}>
            Charts
          </Link>
          <Link to="/leaderboard" className={css.nav__link}>
            Leaderboard
          </Link>
          <Link to="https://medium.com/@VeSwaporg" className={css.nav__link}>
            Blogs
          </Link>
          <Link to="https://t.me/VeSwap" className={css.nav__link}>
            Chat
          </Link>
        </div>
        <Link to="/swap" className={css.nav__button}>
          Launch App
        </Link>
      </nav>
      <div className={css.hero}>
        <h1 className={css.hero__heading}>The No.1 Sustainable DEX built on VeChain</h1>
        <p className={css.hero__subheading}>A Secure Platform for Swapping and Managing Sustainable Assets</p>
        <div className={css.hero__bGroup}>
          <Link to="/swap" className={css.hero__button}>
            Launch App
          </Link>
          <Link to="/overview" className={css.hero__button}>
            Charts
          </Link>
        </div>
      </div>
      <div className={css.iconLinks}>
        <a href="https://twitter.com/veswaporg_" className={css.link}>
          <IconTwitter />
        </a>
        <a href="https://t.me/VeSwap" className={css.link}>
          <IconTelegram />
        </a>
        <a href="https://medium.com/@VeSwaporg" className={css.link}>
          <IconMedium />
        </a>
        <a href="https://linktr.ee/VeSwaporg" className={css.link}>
          <IconLinktree />
        </a>
      </div>
    </div>
  );
}
