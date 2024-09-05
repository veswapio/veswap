import { atom } from "jotai";

export const transactionStatusAtom = atom<
  | {
      isPending: boolean;
      isSuccessful: boolean;
      isFailed: boolean;
      transactionHash: string | null;
      message: string | null;
    }
  | undefined
>(undefined);
