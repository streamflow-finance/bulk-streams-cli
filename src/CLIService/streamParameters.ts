import inquirer from "inquirer";
import { promptDateTime, promtTimePeriod } from "./date";
import multiselect from "@inquirer/checkbox";

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

export const getStreamParameters = async (): Promise<ICLIStreamParameters> => {
  const start = await promptDateTime("start", "(leave empty to start immediately)");
  const duration = await promtTimePeriod("vesting duration");
  const { unlockCountStr } = await inquirer.prompt([{
    type: "input",
    name: "unlockCountStr",
    message: `How many unlocks should be during vesting period?`,
  }]);
  const unlockCount = parseInt(unlockCountStr);
  const { cliffPercentage } = await inquirer.prompt([{
    type: "input",
    name: "cliffPercentage",
    message: `Percentage to be unlocked on start (cliff)?`,
  }]);
  const vestingOptions = await multiselect({
    message: "Vesting contract options",
    choices: [{
      name: "Is Cancelable By Sender",
      value: "cancelableBySender",
      checked: true,
    },{
      name: "Is Cancelable By Recipient",
      value: "cancelableByRecipient"
    },{
      name: "Is Transferable By Sender",
      value: "transferableBySender"
    },{
      name: "Is Transferable By Recipient",
      value: "transferableByRecipient",
      checked: true,
    },{
      name: "Automatic Withdrawal is enabled",
      value: "automaticWithdrawal"
    },{
      name: "Vesting contract can be Topped up",
      value: "canTopup"
    },],
  });
  const vestingOptionsSet = new Set(vestingOptions);

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
    cliffPercentage: parseFloat(cliffPercentage) || 0,
    cancelableBySender,
    cancelableByRecipient,
    automaticWithdrawal,
    transferableBySender,
    transferableByRecipient,
    canTopup,
  }
};