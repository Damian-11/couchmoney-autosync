import * as z from "zod";
import "dotenv/config";
import logger from "./logger.js";
import startSchedule from "./scheduler.js";

const ENV_SCHEMA = z.object({
  INTERVAL_DAYS: z.coerce.number().int().min(1).max(24).default(7),
  ACCOUNT_CREDENTIALS: z.string().check(z.minLength(3)),
});

// Extract username-password combos. Each combo is separated by a newline,
// and has the format username:password
function parseCredentials(credentialString: string) {
  const credentialCombos = credentialString.split("\n");
  let credentials: { [username: string]: string } = {};
  for (const combo of credentialCombos) {
    logger.debug(combo);
    const split = combo.split(":");
    const username = split[0];
    // Join rest back together in case of a colon in the password string
    const password = split.slice(1).join(":");
    if (!username || !password) {
      logger.error(`Invalid credential format: "${combo}"`);
      return;
    }
    credentials[username] = password;
  }
  logger.debug("Credentials:", credentials);
  return credentials;
}

let credentials: { [password: string]: string } = {};
let result = ENV_SCHEMA.safeParse(process.env);
if (!result.success) {
  logger.error(result.error);
  logger.error("Error while validating environment - exiting...");
  process.exit(1);
}

logger.debug("Validated environment successfully");
// Parse usernames + passwords
const parsedData = parseCredentials(result.data.ACCOUNT_CREDENTIALS);
if (!parsedData) {
  logger.error("Error while parsing ACCOUNT_CREDENTIALS - exiting...");
  process.exit(1);
}
credentials = parsedData;
logger.info(
  `Parsed username-password pairs for ${Object.keys(credentials).length} user(s)`,
);
startSchedule(result.data.INTERVAL_DAYS, credentials);
