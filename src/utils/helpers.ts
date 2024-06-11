import BigNumber from "bignumber.js";

export function truncateAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatBigNumber(bn: string | BigNumber, decimals = 6) {
  return BigNumber(bn)
    .toFormat(decimals)
    .replace(/\.?0+$/, "");
}

export function fixedBigNumber(bn: BigNumber, decimals = 6) {
  return bn.toFixed(decimals, 1).replace(/\.?0+$/, "");
}

export function bigNumberToWei(bn: string | BigNumber, decimals = 18) {
  return BigNumber(bn)
    .times(10 ** decimals)
    .toFixed(0);
}
