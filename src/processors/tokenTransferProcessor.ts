import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getBN } from "@streamflow/stream";

import { IRecipientInfo } from "../utils/recipientStream";

export const processTokenTransfer = async (
  connection: Connection,
  sender: Keypair,
  recipientInfo: IRecipientInfo,
  mint: PublicKey,
  decimals: number,
  computePrice?: number,
): Promise<{ txId: string }> => {
  const recentBlockInfo = await connection.getLatestBlockhash();
  const recipientAta = await getOrCreateAssociatedTokenAccount(connection, sender, mint, recipientInfo.address);
  const senderAta = await getAssociatedTokenAddress(mint, sender.publicKey);
  const amount = getBN(recipientInfo.amount, decimals).toString();

  const ix = createTransferCheckedInstruction(
    senderAta,
    mint,
    recipientAta.address,
    sender.publicKey,
    BigInt(amount),
    decimals,
  );
  const tx = new Transaction({
    feePayer: sender.publicKey,
    ...recentBlockInfo,
  });
  if (computePrice) {
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computePrice }));
  }
  tx.add(ix);
  tx.partialSign(sender);
  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const res = await connection.confirmTransaction({ ...recentBlockInfo, signature }, "confirmed");
  if (res.value.err) {
    throw new Error(res.value.err.toString());
  }
  return { txId: signature };
};
