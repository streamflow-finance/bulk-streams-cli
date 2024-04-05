import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SendTransactionError, SYSVAR_RENT_PUBKEY, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { StreamflowSolana, getBN, } from "@streamflow/stream";
import { ICluster, sleep } from "@streamflow/common";
import { confirmAndEnsureTransaction, TransactionFailedError } from "@streamflow/common/solana";
import BN from "bn.js";
import bs58 from "bs58";
import throttledQueue from 'throttled-queue';

import { ICLIStreamParameters } from "../CLIService/streamParameters";
import { IRecipientInfo } from "../utils/recipientStream";

const SEND_THROTTLE = throttledQueue(2, 1000); // 2 sends per second
const { PROGRAM_ID, STREAMFLOW_TREASURY_PUBLIC_KEY, FEE_ORACLE_PUBLIC_KEY, WITHDRAWOR_PUBLIC_KEY } =
  StreamflowSolana.constants;
const { createStreamInstruction } = StreamflowSolana;

export const processVestingContract = async (
  connection: Connection,
  useDevnet: boolean,
  programId: string | null,
  sender: Keypair,
  recipientInfo: IRecipientInfo,
  mint: PublicKey,
  decimals: number,
  streamParameters: ICLIStreamParameters,
  computePrice?: number,
): Promise<{ txId: string; contractId: string }> => {
  if (!programId) {
    programId = PROGRAM_ID[useDevnet ? ICluster.Devnet : ICluster.Mainnet];
  }
  const pid = new PublicKey(programId);
  const metadata = Keypair.generate();
  const [escrowTokens] = PublicKey.findProgramAddressSync([Buffer.from("strm"), metadata.publicKey.toBuffer()], pid);

  const senderTokens = await getAssociatedTokenAddress(mint, sender.publicKey, true);
  const recipientTokens = await getAssociatedTokenAddress(mint, recipientInfo.address, true);
  const streamflowTreasuryTokens = await getAssociatedTokenAddress(mint, STREAMFLOW_TREASURY_PUBLIC_KEY, true);
  const amount = getBN(recipientInfo.amount, decimals);
  const period = streamParameters.duration / streamParameters.unlockCount;
  const amountWithoutCliff = amount.mul(new BN(10000 - 100 * streamParameters.cliffPercentage)).div(new BN(10000));
  const amountPerPeriod = amountWithoutCliff.div(new BN(streamParameters.unlockCount));
  const cliffAmount = amount.mul(new BN(100 * streamParameters.cliffPercentage)).div(new BN(10000));
  let automaticWithdrawal = streamParameters.automaticWithdrawal;
  let withdrawFrequency = new BN(period);
  if (!automaticWithdrawal) {
    automaticWithdrawal = true;
    withdrawFrequency = new BN(0);
  }

  const ix = createStreamInstruction(
    {
      start: new BN(streamParameters.start),
      depositedAmount: amount,
      period: new BN(period),
      amountPerPeriod,
      cliff: new BN(streamParameters.start),
      cliffAmount,
      cancelableBySender: streamParameters.cancelableBySender,
      cancelableByRecipient: streamParameters.cancelableByRecipient,
      automaticWithdrawal,
      transferableBySender: streamParameters.transferableBySender,
      transferableByRecipient: streamParameters.transferableByRecipient,
      canTopup: streamParameters.canTopup,
      name: recipientInfo.name ?? "",
      withdrawFrequency,
    },
    pid,
    {
      sender: sender.publicKey,
      senderTokens,
      recipient: recipientInfo.address,
      metadata: metadata.publicKey,
      escrowTokens,
      recipientTokens,
      streamflowTreasury: STREAMFLOW_TREASURY_PUBLIC_KEY,
      streamflowTreasuryTokens,
      partner: sender.publicKey,
      partnerTokens: senderTokens,
      mint: new PublicKey(mint),
      feeOracle: FEE_ORACLE_PUBLIC_KEY,
      rent: SYSVAR_RENT_PUBKEY,
      timelockProgram: pid,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      withdrawor: WITHDRAWOR_PUBLIC_KEY,
      systemProgram: SystemProgram.programId,
    },
  );

  const commitment = "confirmed";
  const { context, value: recentBlockInfo } = await connection.getLatestBlockhashAndContext({ commitment });

  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: 220_000 })];
  if (computePrice) {
    ixs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computePrice }));
  }
  ixs.push(ix);
  const messageV0 = new TransactionMessage({
    payerKey: sender.publicKey,
    recentBlockhash: recentBlockInfo.blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(messageV0);
  tx.sign([sender, metadata]);

  for (let i = 0; i < 3; i++) {
    const res = await connection.simulateTransaction(tx, { commitment });
    if (res.value.err) {
      const errMessage = res.value.err.toString();
      if (!errMessage.includes("BlockhashNotFound") || i === 2) {
        throw new Error(errMessage);
      }
    }
    break;
  }

  let signature = bs58.encode(tx.signatures[0]);
  let blockheight = await connection.getBlockHeight(commitment);
  const rawTransaction = tx.serialize();
  let transactionSent = false;
  while (blockheight < recentBlockInfo.lastValidBlockHeight + 15) {
    try {
      if (blockheight < recentBlockInfo.lastValidBlockHeight || !transactionSent) {
        await SEND_THROTTLE(async () => {
          await connection.sendRawTransaction(rawTransaction, {
            maxRetries: 0,
            minContextSlot: context.slot,
            preflightCommitment: commitment,
            skipPreflight: true,
          })
        });
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
        return { txId: signature, contractId: metadata.publicKey.toBase58() };

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

  throw new Error(`${recipientInfo.address}: transaction ${signature} expired.`);
};
