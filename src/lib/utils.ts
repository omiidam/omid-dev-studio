import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Converts ASCII digits to Persian digits, e.g. "1.0.1" → "۱.۰.۱". */
export function toFaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}