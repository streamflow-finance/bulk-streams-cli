import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { constants } from "@streamflow/stream/solana";

const MINT_OFFSET = 177;

export async function fetchExistingStream(connection: Connection, programId: PublicKey, mint: PublicKey, recipient: PublicKey): Promise<string | null> {
  const streams = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: MINT_OFFSET,
          bytes: mint.toBase58(),
        },
      },
      {
        memcmp: {
          offset: constants.STREAM_STRUCT_OFFSET_RECIPIENT,
          bytes: recipient.toBase58(),
        },
      },
    ],
  });
  if (streams.length > 0) {
    return streams[0].pubkey.toBase58();
  }
  return null;
}


export function buildStreamTransaction(ixs: TransactionInstruction[], blockhash: string, sender: Keypair, metadata: Keypair): VersionedTransaction {
  const messageV0 = new TransactionMessage({
    payerKey: sender.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);
  tx.sign([sender, metadata]);
  return tx;
}
