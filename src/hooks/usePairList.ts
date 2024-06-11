import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import tokens from "~/constants/tokens";
import sdk from "~/sdk";

export default function useTokenBalanceList() {
  const connex = useConnex();

  return useQuery({
    queryKey: ["pair-list"],
    refetchInterval: 1000 * 60,
    queryFn: () => {
      return Promise.all([sdk.Fetcher.fetchPairData(tokens[0], tokens[1], connex)]);
    }
  });
}
