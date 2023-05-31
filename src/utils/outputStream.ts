import fs from "fs";
import path from "path";
import { stringify } from 'csv-stringify';

const ts = Date.now().toString();

export const createSuccessStream = () =>  stringify({
  header: true,
  columns: ["Amount", "Wallet Address", "Title", "Email", "TransactionID"]
});

export const createSuccessFileStream = () => {
  const outputPath = path.join(process.cwd(), `./${ts}-success.csv`);
  return fs.createWriteStream(outputPath);
};

export const createInvalidStream = () =>  stringify({
  header: true,
  columns: ["Amount", "Wallet Address", "Title", "Email"]
});

export const createInvalidFileStream = () => {
  const outputPath = path.join(process.cwd(), `./${ts}-invalid.csv`);
  return fs.createWriteStream(outputPath);
};

export const createErrorStream = () =>  stringify({
  header: true,
  columns: ["Amount", "Wallet Address", "Title", "Email"]
});

export const createErrorFileStream = () => {
  const outputPath = path.join(process.cwd(), `./${ts}-error.csv`);
  return fs.createWriteStream(outputPath);
};
