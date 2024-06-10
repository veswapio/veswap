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

export function toWei(stringValue: string, decimalPlaces: number) {
  const weiPerEth = BigInt(10 ** decimalPlaces);
  const [integerPart, decimalPart = ""] = stringValue.split(".");
  const integerWei = BigInt(integerPart) * weiPerEth;
  const decimalWei = BigInt(decimalPart.padEnd(decimalPlaces, "0"));
  return (integerWei + decimalWei).toString();
}
