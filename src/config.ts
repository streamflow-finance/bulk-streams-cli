import { InvalidArgumentError } from "commander";
import { IOptionConfig } from "./CLIService/types";
import { validateInteger, validateFloat } from "./utils/validators";

const defaultRPC = "https://api.mainnet-beta.solana.com";
const defaultSpeed = 100;
const VESTING_OPTIONS = ["cancelableBySender", "cancelableByRecipient", "automaticWithdrawal", "transferableBySender", "transferableByRecipient", "canTopup"];
const SEVENTY_YEARS_IN_SECS = 70 * 365 * 24 * 60 * 60;

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
    callback: validateInteger,
  },
  {
    letter: "p",
    key: "priority-fee",
    valueType: "fee",
    description: `Priority Fee to use, price per CU in micro-lamports https://solana.com/developers/guides/advanced/how-to-use-priority-fees#what-are-priority-fees`,
    request: "",
    callback: validateInteger,
  },
  {
    letter: "v",
    key: "vesting",
    description: `If the transfers should be Streamflow vesting contracts.`,
    request: "",
  },
  {
    key: "vesting-start-ts",
    valueType: "unixtimestamp",
    description: "Start timestamp of vesting, in seconds",
    request: "",
    callback: (val) => {
      const newVal = validateInteger(val);
      const startTs = new Date().getTime() / 1000;
      const endTs = startTs + SEVENTY_YEARS_IN_SECS; // protocol validation
      if (newVal !== 0 && (newVal < startTs || newVal > endTs)) {
        throw new InvalidArgumentError("Invalid start timestamp: should be more than now and less than 70 years in the future");
      }
      return newVal;
    }
  },
  {
    key: "vesting-duration-unit",
    valueType: "duration_unit",
    description: "Duration Unit of vesting, in seconds",
    request: "",
    callback: validateInteger,
  },
  {
    key: "vesting-duration-value",
    valueType: "duration_value",
    description: "For how many Duration Units vesting should last",
    request: "",
    callback: validateInteger,
  },
  {
    key: "vesting-unlock-count",
    valueType: "unlock_count",
    description: "Desired number of Unlocks, first unlock will be at start_ts + unlock_period",
    request: "",
    callback: validateInteger,
  },
  {
    key: "vesting-cliff-percentage",
    valueType: "cliff_percentage",
    description: "Percentage of the amount that should be unlocked right at the start",
    request: "",
    callback: validateFloat,
  },
  {
    key: "vesting-options",
    valueType: "options",
    description: `A Comma Separated list of options, pass an empty string to disable all options, available options are: ${VESTING_OPTIONS.join("\n")}`,
    request: "",
    callback: (val) => {
      if (!val) {
        return [];
      }
      const values = val.split(",").map((item) => item.trim());
      const extraOptions = values.filter((item) => !VESTING_OPTIONS.includes(item));
      if (extraOptions.length > 0) {
        throw new InvalidArgumentError(`Not allowed options: ${extraOptions.join(', ')}`);
      }
      return values;
    }
  },
  {
    letter: "d",
    key: "devnet",
    description: `If Devnet program address should be used. RPC Endpoint should match the network.`,
    request: "",
  },
];

export interface ICLIOptions extends Record<string, any> {
  key: string;
  token: string;
  recipients: string;
  rpc: string;
  programId: string;
  speed: number;
  priorityFee?: number;
  vesting: boolean;
  vestingStartTs?: number;
  vestingDurationUnit?: number;
  vestingDurationValue?: number;
  vestingUnlockCount?: number;
  vestingCliffPercentage?: number;
  vestingOptions?: string[];
  devnet: boolean;
}
