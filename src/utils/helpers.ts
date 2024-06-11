export function truncateAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function bigintToDecimalString(bigintValue: bigint, decimalPlaces: number) {
  const bigintStr = bigintValue.toString();
  const integerPart = bigintStr.slice(0, -decimalPlaces) || "0";

  let fractionPart = bigintStr.slice(-decimalPlaces);
  while (fractionPart.length < decimalPlaces) {
    fractionPart = "0" + fractionPart;
  }
  fractionPart = fractionPart.slice(0, 6).replace(/0+$/, "");

  if (!fractionPart) return integerPart;
  return `${integerPart}.${fractionPart}`;
}

export function toWei(stringValue: string, decimalPlaces = 18) {
  const weiPerEth = BigInt(10 ** decimalPlaces);
  const [integerPart, decimalPart = ""] = stringValue.split(".");
  const integerWei = BigInt(integerPart) * weiPerEth;
  const decimalWei = BigInt(decimalPart.padEnd(decimalPlaces, "0"));
  return (integerWei + decimalWei).toString();
}

export function fromWei(weiValue: string, decimalPlaces = 18) {
  const weiPerEth = BigInt(10 ** decimalPlaces);
  const wei = BigInt(weiValue);
  const integerPart = (wei / weiPerEth).toString();
  const decimalPart = (wei % weiPerEth).toString().padStart(decimalPlaces, "0").slice(0, decimalPlaces);
  return parseFloat(`${integerPart}.${decimalPart}`);
}
