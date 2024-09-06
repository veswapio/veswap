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
