import logger from "./logger.js";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import { differenceInDays, isValid, formatISO } from "date-fns";
import { dirname } from "path/posix";
import startSequence from "./sequence.js";

type SyncTimes = {
  [username: string]: number;
};

// Max amount of retires if sequence fails
const RETRY_AMOUNT = 10;
// Minimum delay between retry attempts in minutes
const RETRY_DELAY = 30;
const DATA_PATH = "data/sync-times.json";
let syncTimes: SyncTimes = {};
async function getSyncTimes(): Promise<SyncTimes | undefined> {
  // Get the times when this script was last ran for each user
  try {
    // Check if file exists
    await access(DATA_PATH);
    return JSON.parse(await readFile(DATA_PATH, { encoding: "utf8" }));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      logger.warning(
        `${DATA_PATH} file not found. This is expected if the script has not been ran before.`,
      );
    } else {
      logger.error("Error reading sync-times.json:\n", error);
    }
  }
}

// Sets the username's latest sync time to now in the DATA_PATH file
async function updateSyncTime(username: string) {
  logger.debug("Updating sync time for", username);
  syncTimes[username] = Date.now();

  try {
    await mkdir(dirname(DATA_PATH), { recursive: true });
    await writeFile(DATA_PATH, JSON.stringify(syncTimes));
    logger.debug("Update successfull!");
  } catch (error) {
    logger.error(`Error writing to ${DATA_PATH}:\n`, error);
  }
}

let INTERVAL = 7;
let retriesPerUser: { [username: string]: number } = {};
async function performSequence(
  username: string,
  password: string,
  delayMinutes: number = 0,
) {
  logger.debug(
    `${username} sync scheduled to happen in ${delayMinutes} minutes`,
  );
  setTimeout(
    async () => {
      logger.info(`Starting sync sequence for ${username} now...`);
      const success = await startSequence(username, password);
      if (success === false) {
        if (
          retriesPerUser[username] &&
          retriesPerUser[username] >= RETRY_AMOUNT
        ) {
          logger.warning(`Exceeded max retries for ${username}. Giving up.`);
          return;
        }
        logger.info(
          `Sequence failed. Retrying sync in ${RETRY_DELAY} minutes...`,
        );
        performSequence(username, password, RETRY_DELAY);
        const currentRetries = retriesPerUser[username] ?? 0;
        retriesPerUser[username] = currentRetries + 1;
      } else {
        logger.info(
          `Sync completed successfully. Next sync is scheduled in ${INTERVAL} days`,
        );
        updateSyncTime(username);
        performSequence(username, password, INTERVAL * 24 * 60);
      }
    },
    delayMinutes * 60 * 1000,
  );
}

async function startSchedule(
  interval: number,
  credentials: { [password: string]: string },
) {
  INTERVAL = interval;
  let currentDelay = 0;
  logger.info("Starting scheduled automation...");
  const syncTimesResult = await getSyncTimes();

  if (syncTimesResult) {
    syncTimes = syncTimesResult;
    logger.info(`Reading ${DATA_PATH} to decide whether to run sync`);
    for (const [username, password] of Object.entries(credentials)) {
      const lastSyncTime = syncTimes[username];
      if (!lastSyncTime) {
        logger.warning(
          `No previous sync time for user ${username}. Scheduling first-time sync in ${currentDelay} minutes`,
        );
        performSequence(username, password, currentDelay);
        currentDelay += 1;
        continue;
      } else if (lastSyncTime && !isValid(lastSyncTime)) {
        logger.error(
          `${DATA_PATH}: Date ${lastSyncTime} is not a valid date. Scheduling sync in ${currentDelay} minutes`,
        );
        performSequence(username, password, currentDelay);
        currentDelay += 1;
        continue;
      }
      logger.debug(
        `Last sync time of ${username} is ${formatISO(lastSyncTime)}`,
      );
      const timeDelta = differenceInDays(new Date(), lastSyncTime);
      if (timeDelta >= interval) {
        logger.info(
          `User ${username} last synced ${timeDelta} days ago. Scheduling sync in ${currentDelay} minutes`,
        );
        performSequence(username, password, currentDelay);
        currentDelay += 1;
      } else {
        logger.info(
          `User ${username} last synced ${timeDelta} days ago. Next sync is scheduled in ${interval - timeDelta} days`,
        );
        performSequence(username, password, 60 * 24 * interval - timeDelta);
      }
    }
    logger.debug("Data file checked successfully");
  } else {
    for (const [username, password] of Object.entries(credentials)) {
      logger.info(
        `Scheduling first-time sync for ${username} in ${currentDelay} minutes`,
      );
      performSequence(username, password, currentDelay);
      currentDelay += 1;
    }
  }
}

export default startSchedule;
