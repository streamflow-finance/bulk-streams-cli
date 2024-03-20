import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, SystemProgram, Transaction } from "@solana/web3.js";
import { StreamflowSolana, getBN, } from "@streamflow/stream";
import { ICluster } from "@streamflow/stream/dist/common/types";
import BN from "bn.js";

import { ICLIStreamParameters } from "../CLIService/streamParameters";
import { IRecipientInfo } from "../utils/recipientStream";

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
  const [escrowTokens] = await PublicKey.findProgramAddress([Buffer.from("strm"), metadata.publicKey.toBuffer()], pid);

  const senderTokens = await getAssociatedTokenAddress(mint, sender.publicKey);
  const recipientTokens = await getOrCreateAssociatedTokenAccount(connection, sender, mint, recipientInfo.address);
  const streamflowTreasuryTokens = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    mint,
    STREAMFLOW_TREASURY_PUBLIC_KEY,
  );
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
      recipientTokens: recipientTokens.address,
      streamflowTreasury: STREAMFLOW_TREASURY_PUBLIC_KEY,
      streamflowTreasuryTokens: streamflowTreasuryTokens.address,
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

  const recentBlockInfo = await connection.getLatestBlockhash();

  const tx = new Transaction({
    feePayer: sender.publicKey,
    ...recentBlockInfo,
  });
  if (computePrice) {
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: computePrice }));
  }
  tx.add(ix);
  tx.partialSign(sender);
  tx.partialSign(metadata);
  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const res = await connection.confirmTransaction({ ...recentBlockInfo, signature }, "confirmed");
  if (res.value.err) {
    throw new Error(res.value.err.toString());
  }
  return { txId: signature, contractId: metadata.publicKey.toBase58() };
};
