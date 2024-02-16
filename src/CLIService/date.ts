import select from "@inquirer/select";
import inquirer from "inquirer";

// Prompts a date and returns it in unix seconds
export const promptDate = async (request: string) => {
  const { rawDate } = await inquirer.prompt([
    {
      type: "input",
      name: "rawDate",
      message: `${request} (Format YYYY/MM/DD)`,
    },
  ]);

  if (!rawDate) return 0;

  return +new Date(rawDate) / 1000;
};

export const promptTime = async (request: string) => {
  const { rawTime } = await inquirer.prompt([
    {
      type: "input",
      name: "rawTime",
      message: `${request} (Format HH:MM 24h notation)`,
    },
  ]);

  const [hours, minutes] = rawTime.split(":");

  return parseInt(hours) * 3600 + parseInt(minutes) * 60;
};

export const promptDateTime = async (field: string, note?: string) => {
  const date = await promptDate(`Please enter ${field} date ${note}`);
  if (!date) return 0;

  const time = await promptTime(`Please enter ${field} time`);

  return date + time;
};

const timePeriods = [
  {
    name: "Second",
    value: 1,
  },
  {
    name: "Minute",
    value: 60,
  },
  {
    name: "Hour",
    value: 60 * 60,
  },
  {
    name: "Day",
    value: 60 * 60 * 24,
  },
  {
    name: "Week",
    value: 60 * 60 * 24 * 7,
  },
  {
    name: "Month",
    value: 60 * 60 * 24 * 30,
  },
  {
    name: "Year",
    value: 60 * 60 * 24 * 365,
  },
];

export const promtTimePeriod = async (field: string): Promise<number> => {
  const period = await select({
    message: `Please enter ${field} unit`,
    choices: timePeriods,
  });
  const periodName = timePeriods.find((timePeriod) => timePeriod.value === period)?.name;
  const { value } = await inquirer.prompt([
    {
      type: "input",
      name: "value",
      message: `Please enter ${field} value (How many ${periodName}s)?`,
    },
  ]);

  return Math.trunc(period * parseFloat(value));
};
