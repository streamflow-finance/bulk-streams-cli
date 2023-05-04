#!/usr/bin/env node

import { Command } from "commander";
import { loadCSV } from "./csvHandler.js";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import figlet from "figlet";
import chalk from "chalk";

import fs from "fs";
import path from "path";



const print = console.log;
const program = new Command();

print(chalk.blueBright(figlet.textSync("Streamflow Stream CLI")));

async function main() {
  program
    .version("1.0.0")
    .description("A CLI tool to create Streamflow streams")
    .requiredOption("-k, --key <path>", "Private key path")
    //   .option("-t, --token <mint>", "Target token to exchange, interactive when not specified!")
    .option("-A, --all", "Swap all tokens", false)
    //   .option("-r, --rpc <url>", "RPC", defaultRPC)
    .parse();

  const options = program.opts();

  if (!options.all) return 0;

  const key = getKeypair(readPrivateKey(options.key));

  const streams = await loadCSV("./template.csv");
  console.log(streams);
}

function readPrivateKey(keyFilePath) {
  return fs.readFileSync(path.join(process.cwd(), keyFilePath)).toString();
}

function getKeypair(key) {
  return Keypair.fromSecretKey(bs58.decode(key));
}

main();
