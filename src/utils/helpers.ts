export function truncateAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function toWei(stringValue: string, decimalPlaces = 18) {
  const weiPerEth = BigInt(10 ** decimalPlaces);
  const [integerPart, decimalPart = ""] = stringValue.split(".");
  const integerWei = BigInt(integerPart) * weiPerEth;
  const decimalWei = BigInt(decimalPart.padEnd(decimalPlaces, "0"));
  return (integerWei + decimalWei).toString();
}
