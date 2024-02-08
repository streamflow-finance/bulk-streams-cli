import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { IRecipientInfo } from "../utils/recipientStream";

export const processTokenTransfer = async (
  connection: Connection,
  sender: Keypair,
  recipientInfo: IRecipientInfo,
  mint: PublicKey,
  decimals: number
): Promise<string> => {
  const recentBlockInfo = await connection.getLatestBlockhash();
  const recipientAta = await getOrCreateAssociatedTokenAccount(connection, sender, mint, recipientInfo.address);
  const senderAta = await getAssociatedTokenAddress(mint, sender.publicKey);
  const amount = new BN(recipientInfo.amount)
    .mul(new BN(10e9))
    .mul(new BN(10).pow(new BN(decimals)))
    .div(new BN(10e9))
    .toString();

  const ix = createTransferCheckedInstruction(
    senderAta,
    mint,
    recipientAta.address,
    sender.publicKey,
    BigInt(amount),
    decimals
  );
  const tx = new Transaction({
    feePayer: sender.publicKey,
    ...recentBlockInfo,
  });
  tx.add(ix);
  tx.partialSign(sender);
  return connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
};
