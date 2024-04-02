import { Wallet } from "@project-serum/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import EventEmitter from "events";
import fs from "fs";
import path from "path";
import { Transform } from "stream";

import { CLIService } from "./CLIService";
import { getStreamParameters } from "./CLIService/streamParameters";
import { ICLIOptions, cliOptions } from "./config";
import { processTokenTransfer } from "./processors/tokenTransferProcessor";
import { processVestingContract } from "./processors/vestingContractProcessor";
import {
  createErrorFileStream,
  createErrorStream,
  createInvalidFileStream,
  createInvalidStream,
  createSuccessFileStream,
  createSuccessStream,
} from "./utils/outputStream";
import { RecipientProgress } from "./utils/progress";
import { IRecipientInfo, createRecipientStream } from "./utils/recipientStream";
import { getTokenDecimals, getTokenMetadataMap, getUserTokens, prepareUserChoices } from "./utils/tokens";

(async () => {
  const cli = new CLIService<ICLIOptions>(cliOptions);
  await cli.init();

  console.log("Reading private key.");
  const keyPath = cli.getOptions().key;
  const keyPathFormatted = path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath);
  const privateKey = JSON.parse(fs.readFileSync(keyPathFormatted).toString());
  const keypair = Keypair.fromSeed(Buffer.from(privateKey).subarray(0, 32));
  const wallet = new Wallet(keypair);
  const sender = wallet.publicKey;

  console.log("Connecting to RPC node.");
  const connection = new Connection(cli.getOptions().rpc);

  console.log("Getting token metadata.");
  const userTokens = await getUserTokens(connection, sender);
  const tokenMetaMap = await getTokenMetadataMap();

  if (!cli.getOptions().token) {
    await cli.specifyOption("token", "Select a token to distribute.", prepareUserChoices(userTokens, tokenMetaMap));
  }

  const mintStr = cli.getOptions().token;
  const mint = new PublicKey(mintStr);
  const decimals = await getTokenDecimals(connection, mint);

  const recipientsPath = cli.getOptions().recipients;
  const rate = parseInt(cli.getOptions().speed);

  // Processing vesting parameters
  const isVestingContract = cli.getOptions().vesting;
  const useDevnet = cli.getOptions().devnet;
  const vestingContractParameters = isVestingContract ? await getStreamParameters() : null;
  const priorityFee = cli.getOptions().priorityFee;
  const programId = cli.getOptions().programId;
  const computePrice = priorityFee ? parseInt(priorityFee) : undefined;

  const progress = new RecipientProgress();

  const recipientStream: Transform = createRecipientStream(recipientsPath, rate);
  let successCounter = 0;
  const successStream = createSuccessStream(!!isVestingContract);
  successStream.pipe(createSuccessFileStream());
  let invalidCounter = 0;
  const invalidStream = createInvalidStream();
  invalidStream.pipe(createInvalidFileStream());
  let errorCounter = 0;
  const errorStream = createErrorStream();
  errorStream.pipe(createErrorFileStream());

  const startTime = process.hrtime();
  let activeProcessing = 0;
  let processingStarted = false;
  const processingEvent = new EventEmitter();
  recipientStream.on("data", async (row: IRecipientInfo) => {
    activeProcessing++;
    processingStarted = true;
    if (!row.isValid) {
      invalidStream.write(row.rawData.split(","));
      progress.invalid();
      invalidCounter++;
      activeProcessing--;
      return;
    }

    try {

      if (isVestingContract) {
        const { txId, contractId } = await processVestingContract(
          connection,
          !!useDevnet,
          programId,
          keypair,
          row,
          mint,
          decimals,
          vestingContractParameters!,
          computePrice,
        )
        successStream.write([row.amount, row.address.toBase58(), row.name, row.email, txId, contractId]);
      } else {
        const { txId } = await processTokenTransfer(connection, keypair, row, mint, decimals, computePrice);
        successStream.write([row.amount, row.address.toBase58(), row.name, row.email, txId]);
      }
      progress.success();
      successCounter++;
    } catch (e) {
      progress.retry();
      errorStream.write(row.rawData.split(","));
      console.info(e);
      errorCounter++;
    }
    activeProcessing--;
  });

  recipientStream.on("close", async () => {
    while (processingStarted && activeProcessing > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    progress.end();
    console.log("CSV file has been processed!");
    if (successCounter) console.log(chalk.green(`${successCounter} Transfers have been successful!`));
    if (errorCounter)
      console.log(
        chalk.yellow(
          `${errorCounter} Transfers have failed, you can retry transfers by reusing error.csv output file!`,
        ),
      );
    if (invalidCounter) console.log(chalk.red(`There were ${invalidCounter} invalid rows in the provided file!`));

    const endTime = process.hrtime(startTime);
    const elapsedSeconds = (endTime[0] + endTime[1] / 1e9).toFixed(3);
    console.log("It took " + elapsedSeconds + "seconds");
  });
})();
