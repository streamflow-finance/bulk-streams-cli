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
    valueType: "rpc_url",
    description: `RPC endpoint.`,
    request: "Please specify RPC endpoint.",
    default: defaultRPC,
  },
  {
    letter: "i",
    key: "program-id",
    valueType: "address",
    description: `Streamflow Program ID to use.`,
    request: "",
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
    letter: "p",
    key: "priority-fee",
    valueType: "fee",
    description: `Priority Fee to use, price per CU in micro-lamports https://solana.com/developers/guides/advanced/how-to-use-priority-fees#what-are-priority-fees`,
    request: "",
  },
  {
    letter: "v",
    key: "vesting",
    description: `If the transfers should be Streamflow vesting contracts.`,
    request: "",
  },
  {
    letter: "d",
    key: "devnet",
    description: `If Devnet program address should be used. RPC Endpoint should match the network.`,
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
