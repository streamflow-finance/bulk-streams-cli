#!/usr/bin/env node

const figlet = require("figlet");
const chalk = require("chalk");

const print = console.log;

print(chalk.blueBright(figlet.textSync("Streamflow Stream CLI")));