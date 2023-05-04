import chalk from "chalk";

export function error(msg) {
    console.log(chalk.redBright(msg));
}