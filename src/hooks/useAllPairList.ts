import { useQuery } from "@tanstack/react-query";
import { useConnex } from "@vechain/dapp-kit-react";
import { find } from "lodash";
import IUniswapV2Factory from "~/abis/IUniswapV2Factory.json";
import IUniswapV2Pair from "~/abis/IUniswapV2Pair.json";
import API_ERC20 from "~/abis/erc20.json";
import { FACTORY_ADDRESS } from "~/constants/addresses";

export default function useAllPairList() {
  const connex = useConnex();

  return useQuery({
    queryKey: ["all-pair-list"],
    refetchInterval: 1000 * 180,
    queryFn: () => {
      return connex.thor
        .account(FACTORY_ADDRESS)
        .method(find(IUniswapV2Factory.abi, { name: "allPairsLength" }))
        .call()
        .then((data: any) => {
          const pairIndexList = Array(+data.decoded["0"])
            .fill(null)
            .map((_, i) => i);
          return Promise.all(
            pairIndexList.map((i) =>
              connex.thor
                .account(FACTORY_ADDRESS)
                .method(find(IUniswapV2Factory.abi, { name: "allPairs" }))
                .call(i)
            )
          );
        })
        .then((data: any) => {
          const pairAddressList = data.map((i: any) => i.decoded["0"]);
          return Promise.all(
            pairAddressList.map((i: any) =>
              Promise.all([
                connex.thor
                  .account(i)
                  .method(find(IUniswapV2Pair.abi, { name: "getReserves" }))
                  .call(),
                connex.thor
                  .account(i)
                  .method(find(API_ERC20, { name: "totalSupply" }))
                  .call(),
                connex.thor
                  .account(i)
                  .method(find(IUniswapV2Pair.abi, { name: "token0" }))
                  .call(),
                connex.thor
                  .account(i)
                  .method(find(IUniswapV2Pair.abi, { name: "token1" }))
                  .call(),
                i
              ])
            )
          );
        });
    },
    select: (data: any) => {
      return data.map((i: any) => ({
        reserve0: i[0].decoded["reserve0"],
        reserve1: i[0].decoded["reserve1"],
        lpTotalSupply: i[1].decoded["0"],
        token0Address: i[2].decoded["0"],
        token1Address: i[3].decoded["0"],
        lpAddress: i[4],
      }));
    }
  });
}
