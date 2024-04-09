import { Wallet } from "@project-serum/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { createHash } from "crypto";
import { prompt } from "enquirer";
import fs from "fs";
import path from "path";
import PQueue from "p-queue";
import { Transform } from "stream";

import { CLIService } from "./CLIService";
import { getStreamParameters } from "./CLIService/streamParameters";
import { ICLIOptions, cliOptions } from "./config";
import { processTokenTransfer } from "./processors/tokenTransferProcessor";
import { processVestingContract } from "./processors/vestingContractProcessor";
import {
  createFileStream,
  createErrorPipe,
  createInvalidPipe,
  createSuccessPipe,
} from "./utils/outputStream";
import { RecipientProgress } from "./utils/progress";
import { IRecipientInfo, createRecipientStream } from "./utils/recipientStream";
import { getTokenDecimals, getTokenMetadataMap, getUserTokens, prepareUserChoices } from "./utils/tokens";
import { toStringifyArray } from "./utils/privateKey";

// Up to 20 concurrent tasks on processing
const PROCESS_QUEUE = new PQueue({ concurrency: 20 });


(async () => {
  const cli = new CLIService<ICLIOptions>(cliOptions);
  await cli.init();

  console.log("Reading private key.");
  const keyPath = cli.getOptions().key;
  const keyPathFormatted = path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath);
  let privateKey = fs.readFileSync(keyPathFormatted).toString();
  privateKey = toStringifyArray(privateKey);

  privateKey = JSON.parse(privateKey);
  const keypair = Keypair.fromSeed(Buffer.from(privateKey).subarray(0, 32));
  const wallet = new Wallet(keypair);
  const sender = wallet.publicKey;
  const useDevnet = cli.getOptions().devnet;

  if (!cli.getOptions().rpc) {
    return cli.error(chalk.red("\n[Error]: Cannot connect to RPC node. RPC URL is not provided."));
  }

  console.log(`Connecting to RPC node. RPC URL: ${cli.getOptions().rpc}`);
  const connection = new Connection(cli.getOptions().rpc);

  console.log("Getting token metadata.");
  const userTokens = await getUserTokens(connection, sender);
  const tokenMetaMap = await getTokenMetadataMap(useDevnet);

  if (!cli.getOptions().token) {
    await cli.specifyOption("token", "Select a token to distribute.", prepareUserChoices(userTokens, tokenMetaMap));
  }

  const mintStr = cli.getOptions().token;
  const mint = new PublicKey(mintStr);
  const decimals = await getTokenDecimals(connection, mint);

  const recipientsPath = cli.getOptions().recipients;
  if (!recipientsPath) {
    return cli.error(chalk.red("\n[Error]: Recipients CSV file path is not provided."));
  }

  const recipientsFile = fs.readFileSync(recipientsPath, "utf-8");
  const columns = recipientsFile.trim().split("\n")[0].split(",");
  const csvContent = recipientsFile.trim().split("\n").slice(1);
  const lastColumn = columns.at(-1);
  const isValidHash = /^[A-Fa-f0-9]{64}$/.test(lastColumn || "");
  const fileHash = createHash("sha256").update(csvContent.join("\n")).digest("hex");

  if (isValidHash) {
    let msg: string;
    if (lastColumn === fileHash) {
      msg = "This file has already been processed, are you sure you want to proceed?";
    } else {
      msg = "It seems that this file has already been processed, but was modified afterwards. Are you sure you want to proceed?";
    }
    const res = await prompt<{ proceed: boolean }>({
      name: "proceed",
      type: "toggle",
      enabled: "Yes",
      disabled: "No",
      message: msg,
    });
    if (!res.proceed) {
      return;
    }
  }

  const rate = cli.getOptions().speed;

  // Processing vesting parameters
  const isVestingContract = cli.getOptions().vesting;
  const vestingContractParameters = isVestingContract ? await getStreamParameters(cli.getOptions()) : null;
  const priorityFee = cli.getOptions().priorityFee;
  const programId = cli.getOptions().programId;
  const computePrice = priorityFee;

  const res = await prompt<{ proceed: boolean }>({
    name: "proceed",
    type: "toggle",
    enabled: "Yes",
    disabled: "No",
    message: "Are all these parameters correct? Pressing `Yes` will start the procedure.",
  });
  if (!res.proceed) {
    return;
  }

  const progress = new RecipientProgress();

  const recipientStream: Transform = createRecipientStream(recipientsPath, rate);
  const { stream: successStream, name: successName } = createSuccessPipe(isVestingContract);
  successStream.pipe(createFileStream(successName));
  const { stream: invalidStream, name: invalidName } = createInvalidPipe();
  invalidStream.pipe(createFileStream(invalidName));
  const { stream: errorStream, name: errorName } = createErrorPipe();
  errorStream.pipe(createFileStream(errorName));

  const startTime = process.hrtime();
  let processingStarted = false;

  recipientStream.on("data", async (row: IRecipientInfo) => PROCESS_QUEUE.add(async () => {
    processingStarted = true;
    if (!row.isValid) {
      invalidStream.write(row.rawData.split(","));
      await progress.tick("invalid");
      return;
    }
    await progress.tick("active", 0, 1);

    try {
      if (isVestingContract) {
        const { txId, contractId } = await processVestingContract(
          connection,
          useDevnet,
          programId,
          keypair,
          row,
          mint,
          decimals,
          vestingContractParameters!,
          computePrice,
        );
        successStream.write([row.amount, row.address.toBase58(), row.name, row.email, txId, contractId]);
      } else {
        const { txId } = await processTokenTransfer(connection, keypair, row, mint, decimals, computePrice);
        successStream.write([row.amount, row.address.toBase58(), row.name, row.email, txId]);
      }
      await progress.tick("success");
    } catch (e) {
      await progress.tick("retries");
      errorStream.write(row.rawData.split(","));
      console.info(`\n${row.address}: ${e}`);
    }
    await progress.tick("active", 0, -1);
  }));

  recipientStream.on("close", async () => {
    while (processingStarted && progress.getTokens().active > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    progress.end();
    const tokens = progress.getTokens();
    fs.writeFileSync(recipientsPath, [[...columns, fileHash].join(","), ...csvContent].join("\n"));
    console.log("\nCSV file has been processed!");
    if (tokens.success) console.log(chalk.green(`${tokens.success} Transfers have been successful!`));
    if (tokens.retries)
      console.log(
        chalk.yellow(
          `${tokens["retries"]} Transfers have failed, you can retry transfers by reusing ${errorName} output file!`,
        ),
      );
    if (tokens.invalid) console.log(chalk.red(`There were ${tokens.invalid} invalid rows in the provided file!`));

    const endTime = process.hrtime(startTime);
    const elapsedSeconds = (endTime[0] + endTime[1] / 1e9).toFixed(3);
    console.log("It took " + elapsedSeconds + " seconds");
  });
})();
