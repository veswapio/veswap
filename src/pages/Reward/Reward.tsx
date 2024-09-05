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

import rewardTestData from "../../reward-data/round-result-test.json";
import rewardRonud1Data from "../../reward-data/round1-result.json";
import rewardRonud2Data from "../../reward-data/round2-result.json";

const claimAddresses = [
  "0x0fa367d0b916128a2e66a7744394a64e6af5f31b", // test
  "0x53425ed53140c53b9fd7c024cc8b5bf8b6e09bf6", // round1
  "0xF48B13252555eA5Ae5019ca24e0C30893Afb478C" // round2
];
const claimHeadings = ["Test", "Launched the $B3TR/ $VET trading pair on VeSwap!", "2K followers"];

export default function Reward() {
  const { account } = useWallet();
  const connex = useConnex();
  const [claimedRecord, setClaimedRecord] = useState([false, false, false]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setTransactionStatus] = useAtom(transactionStatusAtom);

  const rewards = useMemo(() => {
    if (!account) return [];
    return [
      Object.entries(rewardTestData.claims).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1],
      Object.entries(rewardRonud1Data.claims).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1],
      Object.entries(rewardRonud2Data.claims).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1]
    ];
  }, [account]);

  useEffect(() => {
    async function fetchRewardData() {
      if (!rewards || !connex) return;

      try {
        const isTestClaimed =
          rewards[0] &&
          (await connex.thor
            .account(claimAddresses[0])
            .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
            .call(rewards[0].index));
        const isRound1Claimed =
          rewards[1] &&
          (await connex.thor
            .account(claimAddresses[1])
            .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
            .call(rewards[1].index));
        const isRound2Claimed =
          rewards[2] &&
          (await connex.thor
            .account(claimAddresses[2])
            .method(find(ABI_MerkleDistributor.abi, { name: "isClaimed" }))
            .call(rewards[2].index));

        setClaimedRecord([isTestClaimed?.decoded["0"], isRound1Claimed?.decoded["0"], isRound2Claimed?.decoded["0"]]);
      } catch (error) {
        console.log("fetch claimed data error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRewardData();
  }, [connex, rewards, setIsLoading, setClaimedRecord]);

  const handleClaim = async (idx: number) => {
    const reward: any = rewards![idx];
    const method = connex.thor.account(claimAddresses[idx]).method(find(ABI_MerkleDistributor.abi, { name: "claim" }));
    const clause = method.asClause(reward.index, account, reward.amount, reward.proof);

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

  if (!rewards.length || rewards.every((i) => !i)) {
    return (
      <div className={css.claimPanel}>
        <Card className={css.card}>Sorry, you have no rewards at this time.</Card>
      </div>
    );
  }

  return (
    <div className={css.claimGrid}>
      {rewards.map((reward: any, idx: number) => {
        if (!reward) return null;
        return (
          <div className={css.claimPanel} key={`reward-${idx}`}>
            <Card className={css.card}>
              <h2 className={css.card__claimHeading}>
                {claimHeadings[idx]}
                <Tooltip content="rule details" />
              </h2>
              <div className={css.card__claimValue}>{BigNumber(reward.amount).div(1e18).toString()}</div>
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
