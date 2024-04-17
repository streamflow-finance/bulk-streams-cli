import bs58 from "bs58";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  TransactionInstruction,
} from "@solana/web3.js";
import { sleep } from "@streamflow/common";
import {
  confirmAndEnsureTransaction,
  prepareBaseInstructions,
  simulateTransaction,
  TransactionFailedError,
} from "@streamflow/common/solana";
import { getBN } from "@streamflow/stream";
import PQueue from "p-queue";

import { IRecipientInfo } from "../utils/recipientStream";
import { buildTransactionAndSign } from "../utils/transactions";

const DEFAULT_CU = 220_000;
const SIMULATION_CU = 500_000;
const CU_MULTIPLIER = 1.1;
// Up to 2 TX sends at a time, up to 2 per 1 second
const SEND_QUEUE = new PQueue({ concurrency: 2, intervalCap: 2, interval: 1000 });

export const processTokenTransfer = async (
  connection: Connection,
  sender: Keypair,
  recipientInfo: IRecipientInfo,
  mint: PublicKey,
  decimals: number,
  computePrice?: number,
): Promise<{ txId: string }> => {
  const recipientAta = await getAssociatedTokenAddress(mint, recipientInfo.address, true);
  const senderAta = await getAssociatedTokenAddress(mint, sender.publicKey, true);
  const amount = getBN(recipientInfo.amount, decimals).toString();
  const recipientAtaExists = !!(await connection.getAccountInfo(recipientAta));

  const txIxs: TransactionInstruction[] = [];
  if (!recipientAtaExists) {
    txIxs.push(createAssociatedTokenAccountInstruction(sender.publicKey, recipientAta, recipientInfo.address, mint));
  }
  txIxs.push(createTransferCheckedInstruction(
    senderAta,
    mint,
    recipientAta,
    sender.publicKey,
    BigInt(amount),
    decimals,
  ));
  let ixs: TransactionInstruction[] = [
    ...prepareBaseInstructions(connection, {
      computePrice,
      computeLimit: SIMULATION_CU,
    }),
    ...txIxs,
  ];

  const commitment = "finalized";

  while (true) {
    const { context, value: recentBlockInfo } = await connection.getLatestBlockhashAndContext({ commitment });
    let tx = buildTransactionAndSign(ixs, recentBlockInfo.blockhash, sender);
    const res = await simulateTransaction(connection, tx);
    let newCu = DEFAULT_CU;
    if (res.value.unitsConsumed) {
      newCu = Math.floor(res.value.unitsConsumed * CU_MULTIPLIER);
    }
    ixs = [
      ...prepareBaseInstructions(connection, {
        computePrice,
        computeLimit: newCu,
      }),
      ...txIxs,
    ];
    tx = buildTransactionAndSign(ixs, recentBlockInfo.blockhash, sender);

    let signature = bs58.encode(tx.signatures[0]);
    let blockheight = await connection.getBlockHeight(commitment);
    const rawTransaction = tx.serialize();
    let transactionSent = false;
    while (blockheight < recentBlockInfo.lastValidBlockHeight + 15) {
      try {
        if (blockheight < recentBlockInfo.lastValidBlockHeight || !transactionSent) {
          await SEND_QUEUE.add(() => connection.sendRawTransaction(rawTransaction, {
              maxRetries: 0,
              minContextSlot: context.slot,
              preflightCommitment: commitment,
              skipPreflight: true,
            }),
          );
          transactionSent = true;
        }
      } catch (e) {
        if (
          transactionSent ||
          (e instanceof SendTransactionError && e.message.includes("Minimum context slot has not been reached"))
        ) {
          await sleep(500);
          continue;
        }
        throw e;
      }
      await sleep(500);
      try {
        const value = await confirmAndEnsureTransaction(connection, signature);
        if (value) {
          return { txId: signature };
        }
      } catch (e) {
        if (e instanceof TransactionFailedError) {
          throw e;
        }
        await sleep(500);
      }
      try {
        blockheight = await connection.getBlockHeight(commitment);
      } catch (_e) {
        await sleep(500);
      }
    }
    console.warn(`${recipientInfo.address}: transaction ${signature} expired. Will retry in 5 seconds...`);
    await sleep(5000);
  }
};
