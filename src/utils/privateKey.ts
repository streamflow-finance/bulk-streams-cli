import bs58 from "bs58";

export function toStringifyArray(base58PrivateKey: string): string {
  const stringifiedArrayRegex = new RegExp("[d+(,d+)*]");
  // It's already stringified array
  if (stringifiedArrayRegex.test(base58PrivateKey)) return base58PrivateKey;

  return JSON.stringify(Array.from(bs58.decode(JSON.parse(base58PrivateKey))));
}
