import { inspect } from "util";
import { formatISO } from "date-fns";

enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

const LEVEL_COLORS = {
  [LogLevel.DEBUG]: "\x1b[36m",
  [LogLevel.INFO]: "\x1b[32m",
  [LogLevel.WARNING]: "\x1b[33m",
  [LogLevel.ERROR]: "\x1b[31m",
};

// Only print debug logs in development
const DEBUG = process.env.DEBUG === "true";

// Joins array into string while preserving objects with inspect()
function stringifyArray(array: unknown[]) {
  return array
    .map((v, _) => (typeof v === "object" ? inspect(v) : String(v)))
    .join(" ");
}

function send(level: LogLevel, message: unknown[]) {
  if (level === LogLevel.DEBUG && !DEBUG) {
    return;
  }
  const timestamp = formatISO(new Date());
  const color = LEVEL_COLORS[level];
  console.log(color, `[${timestamp}]`, stringifyArray(message), "\x1b[0m");
}

export default {
  debug: (...message: unknown[]) => send(LogLevel.DEBUG, message),
  info: (...message: unknown[]) => send(LogLevel.INFO, message),
  warning: (...message: unknown[]) => send(LogLevel.WARNING, message),
  error: (...message: unknown[]) => send(LogLevel.ERROR, message),
};
