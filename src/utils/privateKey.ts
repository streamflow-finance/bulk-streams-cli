import bs58 from "bs58";

export function toStringifyArray(base58PrivateKey: string): string {
    // It's already stringified array
    if(base58PrivateKey.length >= 64)
        return base58PrivateKey;

    return JSON.stringify(Array.from(bs58.decode(base58PrivateKey)))
}
