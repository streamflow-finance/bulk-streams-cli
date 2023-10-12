import chalk from "chalk";
import { Command } from "commander";
import figlet from "figlet";
import { IInquirerOption, IOptionConfig } from "./types";
import inquirer from "inquirer";
import select from "@inquirer/select";

// Singleton to handle CLI interactions
export class CLIService<TOptions extends Record<string, unknown>> {
  private program: Command;

  private options: Partial<TOptions> = {};

  private optionConfigurations: IOptionConfig<TOptions>[];

  public constructor(options: IOptionConfig<TOptions>[]) {
    this.program = new Command();
    this.optionConfigurations = options;
  }

  public async init(): Promise<void> {
    console.log(chalk.blueBright(figlet.textSync("Streamflow Airdrop CLI")));

    this.program.version("1.0.0").description("A CLI tool to create Airdrops");

    this.optionConfigurations.forEach((option) => {
      this.program.option(
        `-${option.letter}, --${option.key as string}${option.valueType ? ` <${option.valueType}>` : ""}`,
        option.description,
        option.default
      );
    });

    this.program.parse();

    this.options = this.program.opts();

    // Inquire missing options
    const missingOptions = this.optionConfigurations.filter(
      (optionConfig) => !this.options[optionConfig.key] && !!optionConfig.valueType
    );
    const inquiredOptions = await inquirer.prompt(
      missingOptions.map((optionConfig) => ({
        type: "input",
        name: optionConfig.key,
        message: optionConfig.request,
      }))
    );
    this.options = {
      ...this.options,
      ...inquiredOptions,
    };
  }

  public getOptions(): TOptions {
    return this.options as TOptions;
  }

  public async specifyOption(key: keyof TOptions, request: string, options?: IInquirerOption[]) {
    this.options[key] = options
      ? ((await select({
          message: request,
          choices: options,
        })) as TOptions[keyof TOptions])
      : (
          await inquirer.prompt([
            {
              type: "input",
              name: key,
              message: request,
            },
          ])
        )[key];
  }

  public error(message: string): void {
    this.program.error(message);
  }
}
