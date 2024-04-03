import { prompt } from "enquirer";

import { promptDateTime, promtTimePeriod } from "./date";
import { ICLIOptions } from "../config";

export interface ICLIStreamParameters {
  start: number;
  duration: number;
  unlockCount: number;
  cliffPercentage: number;
  cancelableBySender: boolean;
  cancelableByRecipient: boolean;
  automaticWithdrawal: boolean;
  transferableBySender: boolean;
  transferableByRecipient: boolean;
  canTopup: boolean;
}

export const getStreamParameters = async (options: ICLIOptions): Promise<ICLIStreamParameters> => {
  const start = options.vestingStartTs ?? await promptDateTime("start", "(leave empty to start immediately)");
  const duration = options.vestingDuration ?? await promtTimePeriod("vesting duration");
  let unlockCount: number;
  if (options.vestingUnlockCount === undefined) {
    const { unlockCountStr } = await prompt<{ unlockCountStr: string }>([
      {
        type: "input",
        name: "unlockCountStr",
        message: `How many unlocks should be during vesting period?`,
      },
    ]);
    unlockCount = parseInt(unlockCountStr);
  } else {
    unlockCount = options.vestingUnlockCount
  }
  let cliffPercentage: number;
  if (options.vestingCliffPercentage === undefined) {
    const { cliffPercentageStr } = await prompt<{ cliffPercentageStr: string }>([
      {
        type: "input",
        name: "cliffPercentage",
        message: `Percentage to be unlocked on start (cliff)?`,
      },
    ]);
    cliffPercentage = cliffPercentageStr ? parseFloat(cliffPercentageStr) : 0;
  } else {
    cliffPercentage = options.vestingCliffPercentage;
  }
  let vestingOptionsSet: Set<string>;
  if (options.vestingOptions === undefined) {
    const { vestingOptions } = await prompt<{ vestingOptions: string[] }>({
      type: "multiselect",
      name: "vestingOptions",
      message: "Vesting contract options",
      initial: ["cancelableBySender", "transferableByRecipient"],
      // because of this bug https://github.com/enquirer/enquirer/issues/279#issuecomment-623461898
      // @ts-expect-error
      choices: [
        {
          message: "Is Cancelable By Sender",
          name: "cancelableBySender",
        },
        {
          message: "Is Cancelable By Recipient",
          name: "cancelableByRecipient",
        },
        {
          message: "Is Transferable By Sender",
          name: "transferableBySender",
        },
        {
          message: "Is Transferable By Recipient",
          name: "transferableByRecipient",
        },
        {
          message: "Auto-Claim is enabled",
          name: "automaticWithdrawal",
        },
        {
          message: "Vesting contract can be Topped up",
          name: "canTopup",
        },
      ],
    });
    vestingOptionsSet = new Set(vestingOptions);
  } else {
    vestingOptionsSet = new Set(options.vestingOptions);
  }

  const cancelableBySender = vestingOptionsSet.has("cancelableBySender");
  const cancelableByRecipient = vestingOptionsSet.has("cancelableByRecipient");
  const automaticWithdrawal = vestingOptionsSet.has("automaticWithdrawal");
  const transferableBySender = vestingOptionsSet.has("transferableBySender");
  const transferableByRecipient = vestingOptionsSet.has("transferableByRecipient");
  const canTopup = vestingOptionsSet.has("canTopup");

  return {
    start,
    duration,
    unlockCount,
    cliffPercentage,
    cancelableBySender,
    cancelableByRecipient,
    automaticWithdrawal,
    transferableBySender,
    transferableByRecipient,
    canTopup,
  };
};
