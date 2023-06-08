import { IOptionConfig } from "./CLIService/types";

const defaultRPC = "https://api.mainnet-beta.solana.com";
const defaultSpeed = "100";

export const cliOptions: IOptionConfig<ICLIOptions>[] = [
  {
    letter: "k",
    key: "key",
    valueType: "path",
    description: "Private key path",
    request: "Please specify path to the private key file.",
  },
  {
    letter: "t",
    key: "token",
    valueType: "mint",
    description: "Target token mint to send",
    request: "Please paste token mint or leave empty for selector.",
  },
  {
    letter: "f",
    key: "recipients",
    valueType: "path",
    description: "Path to recipients CSV file.",
    request: "Please specify path to the recipients CSV file.",
  },
  {
    letter: "r",
    key: "rpc",
    valueType: "rpcURL",
    description: `RPC endpoint.`,
    request: "Please specify RPC endpoint.",
    default: defaultRPC,
  },
  {
    letter: "s",
    key: "speed",
    valueType: "processing_rate",
    description: `Data processing rate, use higher value for faster RPC nodes.`,
    request: "Please specify data processing rate.",
    default: defaultSpeed,
  },
  {
    letter: "v",
    key: "vesting",
    description: `If the transfers should be Streamflow vesting contracts.`,
    request: "",
  },
];

export interface ICLIOptions extends Record<string, string> {
  key: string;
  token: string;
  recipients: string;
  rpc: string;
  speed: string;
}
