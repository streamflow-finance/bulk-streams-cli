import { parse } from "csv-parse";
import fs from "fs";
import getStream from "get-stream";
import { error } from "./errorHandler.js";

export async function loadCSV(filePath) {
  const parseStream = parse({ delimiter: ",", relax_column_count: true });
  const data = await getStream.array(
    fs.createReadStream(filePath).pipe(parseStream)
  );

  return formatStreams(filterStreams(data));
}

function filterStreams(data) {
  if (data.length === 0) {
    error(`Unexpected format at line ${index + 1}.\n${line}`);
    return [];
  }

  return data
    .map((line, index) => [index + 1, ...line])
    .filter((line, index) => {
      // Remove header
      if (index === 0 && isNaN(+line[1])) {
        return false;
      }

      // Remove empty lines
      if (line.length === 2) return false;

      // Remove lines with invalid data
      if (line.length < 5) {
        const trimmedIndex = line.slice(1);
        error(`Unexpected format at line ${index + 1}.\n${trimmedIndex}`);
        return false;
      }

      return true;
    });
}

function formatStreams(data) {
  return data.map((line) => {
    return {
      lineNum: line[0],
      amount: +line[1],
      address: line[2],
      title: line[3],
      email: line[4],
    };
  });
}
