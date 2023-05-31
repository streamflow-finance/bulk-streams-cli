import path from "path";
import fs from "fs";
import { Throttle } from "stream-throttle";
import { parse } from "csv-parse";
import mapStream from "map-stream";
import { PublicKey } from "@solana/web3.js";

export interface IRecipientInfo {
  amount: number;
  address: PublicKey;
  name?: string;
  email?: string;
  isValid: boolean;
  rawData: string;
}

const createInvalidRecipient = (rawData: string) => ({
  amount: 0,
  address: new PublicKey(0),
  isValid: false,
  rawData,
});

const csvTransformer = mapStream<string[], IRecipientInfo>((data, callback) => {
  try {
    if (data.length < 2) throw new Error();
    const amount = parseFloat(data[0]);
    if (isNaN(amount)) throw new Error();

    const address = new PublicKey(data[1]);
    const name = data[2] ?? "";
    const email = data[3] ?? "";


    callback(null, {
      name,
      amount,
      email,
      address,
      isValid: true,
      rawData: data.join(","),
    });
  } catch (e) {
    callback(null, createInvalidRecipient(data.join(",")));
  }
});

export const createRecipientStream = (filePath: string, rate = 500) => {
  const formattedPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

  return fs
  .createReadStream(formattedPath, "utf-8")
  .pipe(new Throttle({ rate }))
  .pipe(parse({ delimiter: ",", relax_column_count: true, skip_empty_lines: true, from_line: 2 }))
  .pipe(csvTransformer);
};