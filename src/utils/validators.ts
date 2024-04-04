import { InvalidArgumentError } from "commander";

export function validateInteger(val: string): number {
    const newVal = parseInt(val, 10);
    if (isNaN(newVal)) {
        throw new InvalidArgumentError("Not a valid integer");
    }
    return newVal;
}

export function validateFloat(val: string): number {
    const newVal = parseFloat(val);
    if (isNaN(newVal)) {
        throw new InvalidArgumentError("Not a valid integer");
    }
    return newVal;
}