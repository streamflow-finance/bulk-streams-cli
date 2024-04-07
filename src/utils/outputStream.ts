import { stringify } from "csv-stringify";
import fs from "fs";
import path from "path";

const ts = Date.now().toString();

export const createSuccessPipe = (isVestingContract?: boolean) => ({
  name: `${ts}-success.csv`,
  stream: stringify({
    header: true,
    columns: ["Amount", "Wallet Address", "Title", "Email", "TransactionID", ...(isVestingContract ? ["ContractID"] : [])],
  })
});

export const createInvalidPipe = () => ({
  name: `${ts}-invalid.csv`,
  stream: stringify({
    header: true,
    columns: ["Amount", "Wallet Address", "Title", "Email"],
  })
});

export const createErrorPipe = () => ({
  name: `${ts}-error.csv`,
  stream: stringify({
    header: true,
    columns: ["Amount", "Wallet Address", "Title", "Email"],
  })
});

export const createFileStream = (name: string) => {
  const outputPath = path.join(process.cwd(), `./${name}`);
  return fs.createWriteStream(outputPath);
};
