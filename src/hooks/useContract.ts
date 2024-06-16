import { useMemo } from "react";
import { useConnex } from "@vechain/dapp-kit-react";
import ERC20_ABI from "~/abis/erc20.json";
import IUniswapV2Router from "~/abis/IUniswapV2Router02.json";
import { ROUTER_ADDRESS } from "~/constants/addresses";

export function useContract(address: string | undefined, ABI: any) {
  const connex = useConnex();

  return useMemo(() => {
    if (!address || !ABI || !connex) return null;
    try {
      return connex.thor.account(address);
    } catch (error) {
      return null;
    }
  }, [address, ABI, connex]);
}

export function useTokenContract(tokenAddress?: string) {
  return useContract(tokenAddress, ERC20_ABI);
}

export function useV2RouterContract() {
  return useContract(ROUTER_ADDRESS, IUniswapV2Router.abi);
}
