import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenInfo, TokenListProvider } from "@solana/spl-token-registry";
import { Connection, ParsedAccountData, PublicKey } from "@solana/web3.js";
import { IInquirerOption } from "../CLIService/types";

export interface IUserTokenAccount {
  mint: PublicKey;
  decimals: any;
  amount: any;
  uiAmount: any;
}

export const getUserTokens = async (connection: Connection, address: PublicKey): Promise<IUserTokenAccount[]> => {
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(address, { programId: TOKEN_PROGRAM_ID });
  return tokenAccounts.value.map(a => ({
    mint: new  PublicKey(a.account.data.parsed.info.mint),
    decimals: a.account.data.parsed.info.tokenAmount.decimals,
    amount: a.account.data.parsed.info.tokenAmount.amount,
    uiAmount: a.account.data.parsed.info.tokenAmount.uiAmount,
  }));
};

export const prepareUserChoices = (accounts: IUserTokenAccount[], tokenMetaMap: Map<string, TokenInfo>): IInquirerOption[] => accounts.map(tokenAcc => {
  const mintStr = tokenAcc.mint.toBase58();
  const name = tokenMetaMap.get(mintStr)?.name;
  return {
    value: mintStr,
    name: `${mintStr} [Balance: ${tokenAcc.uiAmount}]${name ? ` [Name: ${name}]` : ""}`
  };
})

export const getTokenMetadataMap = async () => {
  const tokenListAll = await new TokenListProvider().resolve();
  const tokenList = tokenListAll.filterByChainId(101).getList();
  return tokenList.reduce((map, item) => {
    map.set(item.address, item);
    return map;
  }, new Map<string, TokenInfo>());
};

export const getTokenDecimals = async (connection: Connection, mint: string | PublicKey): Promise<number> => {
  const mintPK = new PublicKey(mint);
  const response = await connection.getParsedAccountInfo(mintPK);
  return (response.value?.data as ParsedAccountData).parsed.info.decimals;
};
