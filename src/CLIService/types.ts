export interface IOptionConfig<TOptions extends Record<string, unknown>> {
  letter: string;
  key: keyof TOptions;
  description: string;
  request: string;
  default?: string;
  valueType?: string;
}

export interface IInquirerOption {
  message: string;
  name: string;
}
