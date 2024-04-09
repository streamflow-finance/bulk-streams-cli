import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { createStreamInstruction, constants } from "@streamflow/stream/solana";
import { ICluster, sleep, getBN } from "@streamflow/common";
import {
  confirmAndEnsureTransaction,
  prepareBaseInstructions,
  simulateTransaction,
  TransactionFailedError,
} from "@streamflow/common/solana";
import BN from "bn.js";
import bs58 from "bs58";
import PQueue from "p-queue";

import { ICLIStreamParameters } from "../CLIService/streamParameters";
import { IRecipientInfo } from "../utils/recipientStream";
import { buildStreamTransaction, fetchExistingStream } from "../utils/vesting";

const DEFAULT_CU = 220_000;
const SIMULATION_CU = 500_000;
const CU_MULTIPLIER = 1.1;
// Up to 2 TX sends at a time, up to 2 per 1 second
const SEND_QUEUE = new PQueue({ concurrency: 2, intervalCap: 2, interval: 1000 });
const { PROGRAM_ID, STREAMFLOW_TREASURY_PUBLIC_KEY, FEE_ORACLE_PUBLIC_KEY, WITHDRAWOR_PUBLIC_KEY } = constants;

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

  const commitment = "finalized";

  let ixs: TransactionInstruction[] = [
    ...prepareBaseInstructions(connection, {
      computePrice,
      computeLimit: SIMULATION_CU,
    }),
    ix,
  ];

  while (true) {
    const contractId = await fetchExistingStream(connection, pid, mint, recipientInfo.address);
    if (contractId) {
      console.log(`Recipient ${recipientInfo.address.toBase58()} already has a stream for this mint, will skip`);
      return { txId: "", contractId: contractId };
    }

    const { context, value: recentBlockInfo } = await connection.getLatestBlockhashAndContext({ commitment });
    let tx = buildStreamTransaction(ixs, recentBlockInfo.blockhash, sender, metadata);
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
      ix,
    ]
    tx = buildStreamTransaction(ixs, recentBlockInfo.blockhash, sender, metadata);

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
    console.warn(`${recipientInfo.address}: transaction ${signature} expired. Will retry in 5 seconds...`);
    await sleep(5000);
  }
};
