import { find } from "lodash";
import { useAtom } from "jotai";
import BigNumber from "bignumber.js";
import { useState, useMemo, useEffect } from "react";
import { useWallet, useConnex } from "@vechain/dapp-kit-react";

import ABI_MerkleDistributor from "~/abis/MerkleDistributor.json";

import poll from "~/utils/poll";
import { transactionStatusAtom } from "~/store";

import Card from "~/components/Card";
import Button from "~/components/Button";
import Tooltip from "~/components/Tooltip";

import css from "./Reward.module.scss";

import rewardRonud1Data from "../../reward-data/round1-result.json";
import rewardRonud2Data from "../../reward-data/round2-result.json";
import rewardRound23Data from "../../reward-data/round23.json";
import rewardRound24Data from "../../reward-data/round24.json";
import rewardRound25Data from "../../reward-data/round25.json";
import rewardRound26Data from "../../reward-data/round26.json";
import rewardRound27Data from "../../reward-data/round27.json";

const roundList = [
  {
    title: "Launched the $B3TR/ $VET trading pair on VeSwap!",
    tooltip: "",
    address: "0x53425ed53140c53b9fd7c024cc8b5bf8b6e09bf6",
    userList: rewardRonud1Data.claims
  },
  {
    title: "2K followers",
    tooltip: "",
    address: "0xF48B13252555eA5Ae5019ca24e0C30893Afb478C",
    userList: rewardRonud2Data.claims
  },
  {
    title: "Round 23",
    tooltip: "",
    address: "0xac6445fdfe797a90f276312d1537e98bbfd03a6c",
    userList: rewardRound23Data.claims
  },
  {
    title: "Round 24",
    tooltip: "",
    address: "0x0ec54cca20ff5029d4d0a4e0481fead5053af211",
    userList: rewardRound24Data.claims
  },
  {
    title: "Round 25",
    tooltip: "",
    address: "0xf4b3a8deb843050d638c1123df103a61cab0324b",
    userList: rewardRound25Data.claims
  },
  {
    title: "Round 26",
    tooltip: "",
    address: "0x2d225c5dacedee1648e01fb85ea8fe5595b21632",
    userList: rewardRound26Data.claims
  },
  {
    title: "Round 27",
    tooltip: "",
    address: "0x47613e3c5335414b2c505e20edac872999b43fb2",
    userList: rewardRound27Data.claims
  }
];

export default function Reward() {
  const connex = useConnex();
  const { account } = useWallet();
  const [claimedRecord, setClaimedRecord] = useState([] as boolean[]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTransactionStatus] = useAtom(transactionStatusAtom);

  const myRewards = useMemo(() => {
    return roundList.reduce((a, c) => {
      const myClaimData = Object.entries(c.userList).find(([key]) => key.toLowerCase() === account?.toLowerCase())?.[1];
      if (myClaimData) a.push({ ...c, myClaimData });
      return a;
    }, [] as any[]);
  }, [account]);

  useEffect(() => {
    async function fetchRewardData() {
      try {
        Promise.all(
          myRewards.map((round) => {
            return connex.thor
              .account(round.address)
              .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
              .call(round.myClaimData.index);
          })
        ).then((res) => {
          setClaimedRecord(res.map((i: any) => i?.decoded["0"]));
        });
      } catch (error) {
        console.log("fetch claimed data error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (myRewards && connex) {
      fetchRewardData();
    }
  }, [connex, myRewards, setIsLoading, setClaimedRecord]);

  const handleClaim = async (idx: number) => {
    const { address, myClaimData } = myRewards[idx];
    const method = connex.thor.account(address).method(find(ABI_MerkleDistributor.abi, { name: "claim" }));
    const clause = method.asClause(myClaimData.index, account, myClaimData.amount, myClaimData.proof);

    setTransactionStatus({
      isPending: true,
      isSuccessful: false,
      isFailed: false,
      transactionHash: null,
      message: `Claim Reward`
    });

    connex.vendor
      .sign("tx", [clause])
      .comment("Claim Reward")
      .request()
      .then((tx: any) => {
        return poll(() => connex.thor.transaction(tx.txid).getReceipt());
      })
      .then((result: any) => {
        const isSuccess = result.reverted === false;
        setTransactionStatus({
          isPending: false,
          isSuccessful: isSuccess,
          isFailed: !isSuccess,
          transactionHash: result.meta.txID,
          message: null
        });
        if (isSuccess) {
          setClaimedRecord((prev) => {
            const newRecord = [...prev];
            newRecord[idx] = true;
            return newRecord;
          });
        }
      })
      .catch((err: any) => {
        console.log("ERROR");
        console.log(err);
        setTransactionStatus(undefined);
      });
  };

  if (!account) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>Please connect your wallet before proceeding.</Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>
          <div className="loader" />
        </Card>
      </div>
    );
  }

  if (!myRewards.length || myRewards.every((i) => !i)) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>Sorry, you have no rewards at this time.</Card>
      </div>
    );
  }

  return (
    <div className={css.claimGrid}>
      {myRewards.map((round: any, idx: number) => {
        return (
          <div className={css.claimPanel} key={`reward-${idx}`}>
            <Card className={css.card}>
              <h2 className={css.card__claimHeading}>
                {round.title}
                {!!round.tooltip && <Tooltip content={round.tooltip} />}
              </h2>
              <div className={css.card__claimValue}>{BigNumber(round.myClaimData.amount).div(1e18).toFixed(6)}</div>
            </Card>
            {claimedRecord[idx] ? (
              <Button disabled>Already Claimed</Button>
            ) : (
              <Button onPress={() => handleClaim(idx)}>Claim</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
