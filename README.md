# Bulk Stream/Transfer CLI

CLI tool that can load a file and create big number of streams or token transfers (3000+).

## Description

Interactive CLI tool to create a large number of transfers or vesting contracts from CSV file.

## Usage

1. Clone this repo
2. Run `npm install`
3. Run `npm start -- [options]`

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
   - if `vesting` was enabled, it will also output `ContractID` for each created contract after `TransactionID`
2. Errored transactions. Errored file can be used as input for the next run to retry.
3. Invalid rows that script wasn't able to parse.

### Vesting Contracts creation

Creating Vesting contracts are the same, just pass the `-v or --vesting` flag alongside with other parameters.

#### Program ID

You can set custom program id with `-i` or `--program-id` parameter, use it only if you need to use non-standard Streamflow deployment.

#### Vesting Parameters

The script will enquire you about all vesting parameters in interactive prompt. As an alternative though every parameter can be supplied via CLI:

```
  --vesting-start-ts  <unixtimestamp>             Start timestamp of vesting, in seconds
  --vesting-duration-unit  <duration_unit>        Duration Unit of vesting, in seconds
  --vesting-duration-value  <duration_value>      For how many Duration Units vesting should last
  --vesting-unlock-count  <unlock_count>          Desired number of Unlocks, first unlock will be at start_ts + unlock_period
  --vesting-cliff-percentage  <cliff_percentage>  Percentage of the amount that should be unlocked right at the start
  --vesting-options  <options>                    A Comma Separated list of options, pass an empty string to disable all options, available options are:
                                                  cancelableBySender
                                                  cancelableByRecipient
                                                  automaticWithdrawal
                                                  transferableBySender
                                                  transferableByRecipient
                                                  canTopup
```

NOTE: to completely disable vesting options pass `--vesting-options=` (include equal sign to specify that the passed value is an empty string)

#### Brute-force approach

As Solana is heavily congested at the time of writing this, we've implemented a "brute-force" approach for Solana tx landing:

- script retries transactions indefinitely until they either land or error out (blockhash expiring does not count);
- with every tx send loop we check whether a Contract for mint/recipient combination already exist - if the do, we'll skip this recipient and write the existing Contract ID to success csv file;
- custom rebroadcasting is implemented:
  - we send tx in a loop and check whether it has landed with some backoff;
  - we check for tx being landed until Blockhash of the tx expires + we add 15 blocks for checks to make sure;
  - tx rebroadcasting by itself is throttled - as most of RPC pools have pretty strict limitations - up to 2 tx broadcasts in a second;
- as TXs are basically racing with each other we limited the concurrency of Vesting Contracts creation - up to 20 Contracts will be processed at a time;

### Priority Fees

Solana network may be congested, so using just base fee may not be enough to process transaction at times. In this case we recommend to use Priority Fees https://solana.com/developers/guides/advanced/how-to-use-priority-fees.

You can use `-p` parameter to pass custom priority fee that will be set for each transaction. Fee is set per computational unit in micro-lamports, compute limit is set to 220_000 CU. For example, if you set `-p` value to 50000 it would mean that cumulative price per transaction will be `0.000011 SOL` (+ base fee which is fixed to `0.000005 SOL` currently).

```
(5000 / 10^6) * 220000 / 10^9
```

### Technical

Major tools used.

- Typescript
- Node.js Commander (CLI handling)
- Enquirer (User interactive prompts)
- Solana/Web3.js (Blockchain interactions)
- Streamflow/stream SDK (Vesting interactions)
