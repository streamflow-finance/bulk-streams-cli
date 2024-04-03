import bs58 from "bs58";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, SendTransactionError, TransactionExpiredBlockheightExceededError } from "@solana/web3.js";
import { getBN } from "@streamflow/stream";
import { confirmAndEnsureTransaction } from "@streamflow/common/solana";

import { IRecipientInfo } from "../utils/recipientStream";
import { getOrCreateAssociatedTokenAccount } from "../utils/spl";

export const processTokenTransfer = async (
  connection: Connection,
  sender: Keypair,
  recipientInfo: IRecipientInfo,
  mint: PublicKey,
  decimals: number,
  computePrice?: number,
): Promise<{ txId: string }> => {
  const recentBlockInfo = await connection.getLatestBlockhash();
  const recipientAta = await getOrCreateAssociatedTokenAccount({ connection, payer: sender, mint, owner: recipientInfo.address, allowOwnerOffCurve: true, computePrice });
  const senderAta = await getAssociatedTokenAddress(mint, sender.publicKey, true);
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
  let signature = bs58.encode(tx.signature!);
  try {
    signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  } catch (err) {
    if (err instanceof SendTransactionError && err.message.includes("Blockhash not found")) {
      console.log(`\n${recipientInfo.address}: Got 'Blockhash not found', will validate the transaction landing in 3 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } else {
      throw err;
    }
  }
  try {
    const res = await connection.confirmTransaction({
      blockhash: recentBlockInfo.blockhash,
      lastValidBlockHeight: recentBlockInfo.lastValidBlockHeight + 50,
      signature
    }, "confirmed");
    if (res.value.err) {
      throw new Error(res.value.err.toString());
    }
  } catch (e) {
    // If BlockHeight expired, we will check tx status one last time to make sure
    if (e instanceof TransactionExpiredBlockheightExceededError) {
      console.log(`\n${recipientInfo.address}: Got 'BlockHeight expired', will try to confirm anyway in 3 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const value = await confirmAndEnsureTransaction(connection, signature);
      if (!value) {
        throw e;
      }
    }
    throw e;
  }
  return { txId: signature };
};
