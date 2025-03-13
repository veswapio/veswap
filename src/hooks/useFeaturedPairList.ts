import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import tokens from "~/constants/tokens";
import sdk from "~/sdk";

export default function useFeaturedPairList() {
  const connex = useConnex();

  return useQuery({
    queryKey: ["featured-pair-list"],
    refetchInterval: 1000 * 60 * 10,
    queryFn: () => {
      return Promise.all([
        sdk.Fetcher.fetchPairData(tokens[0], tokens[1], connex),
        sdk.Fetcher.fetchPairData(tokens[0], tokens[2], connex),
        sdk.Fetcher.fetchPairData(tokens[0], tokens[3], connex),
        sdk.Fetcher.fetchPairData(tokens[0], tokens[4], connex),
        sdk.Fetcher.fetchPairData(tokens[2], tokens[4], connex)
      ]);
    },
    select: (data: any) => {
      return data.map((i: any) => {
        if (i.liquidityToken.address.toLowerCase() === "0xc6de3b8e4a9bf4a6756e60f5cb6705cb7d3c1649") {
          // swap VET/B3TR to B3TR/VET
          const _i = Object.assign(Object.create(Object.getPrototypeOf(i)), i);
          _i.tokenAmounts = [i.tokenAmounts[1], i.tokenAmounts[0]];
          return _i;
        } else {
          return i;
        }
      });
    }
  });
}
