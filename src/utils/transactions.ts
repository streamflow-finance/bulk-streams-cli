import { Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

export function buildTransactionAndSign(ixs: TransactionInstruction[], blockhash: string, sender: Keypair, ...signers: Keypair[]): VersionedTransaction {
  const messageV0 = new TransactionMessage({
    payerKey: sender.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);
  tx.sign([sender, ...signers]);
  return tx;
}
