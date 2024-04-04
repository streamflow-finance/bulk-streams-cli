import c from "ansi-colors";

export function renderPromptValue(prompt: string, value: string, suffix?: string): void {
    console.log(`${c.green('✔')} ${c.bold(`${prompt}:`)} ${c.green(value)} ${suffix || ''}`)
}
