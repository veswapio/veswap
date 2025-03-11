import { useAtom } from "jotai";
import { Outlet } from "react-router-dom";
import { transactionStatusAtom } from "~/store";
import css from "./SwapLayout.module.scss";

import IconError from "~/assets/error.svg?react";
import IconSuccess from "~/assets/success.svg?react";

export default function SwapLayout() {
  const [transactionStatus, setTransactionStatus] = useAtom(transactionStatusAtom);

  return (
    <div className={css.SwapLayout}>
      <Outlet />

      {transactionStatus && (
        <div className="ModalOverlay">
          <div className="Modal">
            {transactionStatus.isPending && (
              <>
                <div className="loader" />
                <h2 className="Modal__heading center">Waiting for confirmation...</h2>
              </>
            )}
            {transactionStatus.isSuccessful && (
              <>
                <IconSuccess className="Modal__successIcon" />
                <h2 className="Modal__heading center">Transaction Successful</h2>
              </>
            )}
            {transactionStatus.isFailed && (
              <>
                <IconError className="Modal__errorIcon" />
                <h2 className="Modal__heading center">Transaction Failed</h2>
              </>
            )}
            {!!transactionStatus.message && <p className="Modal__subheading">{transactionStatus.message}</p>}
            {!!transactionStatus.rewardData && (
              <a
                style={{ marginBottom: "24px" }}
                className="Modal__link"
                href={`https://x.com/intent/post?text=Just%20claimed%20my%20rewards%20from%20VeBetterDAO%20Round%20${transactionStatus.rewardData.round}!%20🎉%20%0A%0AEarned%20${transactionStatus.rewardData.amount}%20$B3TR%20on%20@veswaporg_ ,%20the%20No.1%20Sustainable%20DEX!%20🌍💚%0A%0ATrade%20%26%20earn%20while%20supporting%20a%20greener%20future!%20🌱🚀%0A👉%20veswap.io`}
                target="_blank"
                rel="noreferrer"
              >
                Share on Twitter
              </a>
            )}
            {!transactionStatus.isPending && (
              <div className="Modal__bgroup">
                <a
                  className="Modal__link"
                  href={`https://explore.vechain.org/transactions/${transactionStatus.transactionHash}#info`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on explorer
                </a>
                <button className="Modal__close" onClick={() => setTransactionStatus(undefined)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
