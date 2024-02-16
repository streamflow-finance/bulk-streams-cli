# Bulk Stream/Transfer CLI

CLI tool that can load a file and create big number of streams or token transfers (3000+).

## Description

Interactive CLI tool to create a large number of transfers or vesting contracts from CSV file.

## Usage

1. Clone this repo
2. Run `npm install`
3. Run `npm start -- [options]`

## Known Issues

- we do not recommend to use this package on Windows as it has numerous issues working with interactive command-line tools

### Token transfers

To make simple token transfers, just run `npm start` and follow the interactive commands.
All the parameters can be passed via CLI call, which will automatically execute transfers and skip interactive prompts.
To see the list of parameters run `npm start -- -h`.
Template CSV file is available in the root directory of the project.

#### Performance

The main performance limitation is the RPC endpoint, which defaults to `https://api.mainnet-beta.solana.com`.
To achieve higher TX/s please pass faster RPC endpoint via `-r` flag and pass higher `-s or --speed` parameter.
`--speed` parameter is a bytes per second processing speed, so find a working ballpark for your RPC endpoint, the tool will auto-retry failed attempts.

#### Output

Script will create 3 output filed.

1. Successful transfers with transaction hashes.
2. Errored transactions. Errored file can be used as input for the next run to retry.
3. Invalid rows that script wasn't able to parse.

### Vesting contracts creation

Creating Vesting contracts are the same, just pass the `-v or --vesting` flag alongside with other parameters.
NOTE: Vesting contracts doesn't have non-interactive mode yet. So you have to set up vesting contract parameters interactively. All other parameters are still valid for vesting contracts. (E.g. speed, rpc, recipients file etc.)

### Technical

Major tools used.

- Typescript
- Node.js Commander (CLI handling)
- Inquirer (User interactive prompts)
- Solana/Web3.js (Blockchain interactions)
- Streamflow/stream SDK (Vesting interactions)
