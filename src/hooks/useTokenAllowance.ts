import { useTokenContract } from "./useContract";
import ERC20_ABI from "~/abis/erc20.json";
import { find } from "lodash";
import sdk, { Token } from "~/sdk";
import { useQuery } from "@tanstack/react-query";
// import { QueryKeys } from "~/utils/helpers";

export const balanceOfABI = find(ERC20_ABI, { name: "balanceOf" });
export const approveABI = find(ERC20_ABI, { name: "approve" });
export const allowanceABI = find(ERC20_ABI, { name: "allowance" });


function getTokenAllowance(
  method: any,
  token: Token
): (owner: string | undefined | null, spender: string | undefined | null) => Promise<sdk.TokenAmount> {
  return async (owner: string | undefined | null, spender: string | undefined | null): Promise<sdk.TokenAmount> =>
    method(allowanceABI).call(owner, spender).then((data: any) => {
      return new sdk.TokenAmount(token, data.decoded[0].toString());
    });
}

export function useTokenAllowance(token: any, owner: string | null, spender: string) {
  const contract = useTokenContract(token?.address);
  // const shouldFetch = !!contract.method && typeof owner === "string" && typeof spender === "string";
  const { data } = useQuery({
    queryKey: ["allowance", owner, spender, token?.address, token?.chainId],
    queryFn: () => getTokenAllowance(contract?.method, token)(owner, spender),
  });

  // useEffect(() => {
  //   const getAllowance = async () => {
  //     const allowanceData = await contract.method(allowanceABI).call(owner, spender);
  //     const rawAmount = allowanceData?.decoded[0];

  //     setAllowance(rawAmount);
  //   };
  //   getAllowance();
  // }, [contract, owner, spender, token]);

  return data;
}
