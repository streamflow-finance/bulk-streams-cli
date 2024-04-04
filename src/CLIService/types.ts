export interface IOptionConfig<TOptions extends Record<string, unknown>> {
  letter?: string;
  key: keyof TOptions;
  description: string;
  request: string;
  default?: any;
  valueType?: string;
  callback?: (value: string, previous: any) => any;
}

export interface IInquirerOption {
  message: string;
  name: string;
}
