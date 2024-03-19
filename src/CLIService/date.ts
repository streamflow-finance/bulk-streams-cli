import { prompt } from "enquirer";

// Prompts a date and returns it in unix seconds
export const promptDate = async (request: string) => {
  const { rawDate } = await prompt<{ rawDate: string }>([
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
  const { rawTime } = await prompt<{ rawTime: string }>([
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
    message: "Second",
    name: 1,
  },
  {
    message: "Minute",
    name: 60,
  },
  {
    message: "Hour",
    name: 60 * 60,
  },
  {
    message: "Day",
    name: 60 * 60 * 24,
  },
  {
    message: "Week",
    name: 60 * 60 * 24 * 7,
  },
  {
    message: "Month",
    name: 60 * 60 * 24 * 30,
  },
  {
    message: "Year",
    name: 60 * 60 * 24 * 365,
  },
];

export const promtTimePeriod = async (field: string): Promise<number> => {
  // because of https://github.com/enquirer/enquirer/issues/405
  // @ts-expect-error
  const { period } = await prompt<{ period: number }>({
    type: "select",
    name: "period",
    message: `Please enter ${field} unit`,
    choices: timePeriods,
  });
  const periodName = timePeriods.find((timePeriod) => timePeriod.name === period)?.message;
  const { value } = await prompt<{ value: string }>([
    {
      type: "input",
      name: "value",
      message: `Please enter ${field} value (How many ${periodName}s)?`,
    },
  ]);

  return Math.trunc(period * parseFloat(value));
};
