import { couchmoneyInstance, traktInstance } from "./axios_client.js";
import logger from "./logger.js";

// Loops over cookies in set-cookie header and returns the value of first cookieName match
// Will error if no matching cookie is found
function extractCookie(
  setCookieHeader: string[] | undefined,
  cookieName: string,
): string {
  if (!setCookieHeader) {
    throw new Error(
      `Error getting ${cookieName} cookie: No set-cookie response header`,
    );
  }
  let targetCookieValue = "";
  for (const cookie of setCookieHeader) {
    const result = cookie.match(new RegExp(`${cookieName}=(.+?);`));
    if (result && result[1]) {
      targetCookieValue = result[1];
      break;
    }
  }
  if (targetCookieValue === "") {
    throw new Error(
      `Error getting ${cookieName} cookie: Cookie not found in set-cookie response header`,
    );
  }
  logger.debug(
    `Extracted ${cookieName} cookie with value ${targetCookieValue}`,
  );
  return targetCookieValue;
}

// Step 1: Get couchmoney's redirect URL and client ID for OAuth
async function getRedirectUrl(): Promise<{
  redirectUrl: string;
  clientId: string;
}> {
  const response = await couchmoneyInstance.get("/login");
  if (typeof response.headers.location !== "string") {
    throw new Error(
      `Error getting redirect URL: No "location" header in response`,
    );
  }
  const location = new URLSearchParams(response.headers.location);
  const redirectUrl = location.get("redirect_uri");
  const clientId = location.get("client_id");
  if (!redirectUrl || !clientId) {
    throw new Error(
      `Error getting redirect URL: "Location" header has no ${redirectUrl ? "client_id" : "redirect_uri"} query string`,
    );
  }
  logger.debug("Step 1 success");
  return { redirectUrl: redirectUrl, clientId: clientId };
}

// Use overloads to tell TS that an object is returned only when traktSession specified
async function getTraktSession(
  redirectUrl: string,
  clientId: string,
): Promise<string>;
async function getTraktSession(
  redirectUrl: string,
  clientId: string,
  traktSession: string,
): Promise<{ traktSession: string; csrfToken: string }>;

// Step 2: Get _traktsession cookie
// Step 5: Get session and CSRF token (while logged in)
async function getTraktSession(
  redirectUrl: string,
  clientId: string,
  traktSession?: string,
): Promise<string | { traktSession: string; csrfToken: string }> {
  const response = await traktInstance.get(
    `/oauth/authorize?response_type=code&redirect_uri=${redirectUrl}&state=init&client_id=${clientId}`,
    // If session cookie specified, use it to get CSRF token
    traktSession
      ? {
          headers: { Cookie: `_traktsession=${traktSession};` },
        }
      : undefined,
  );
  const setCookie = response.headers["set-cookie"];
  const traktSessionCookie = extractCookie(setCookie, "_traktsession");

  if (traktSession) {
    const csrfToken = response.data.match(
      /<meta name="csrf-token" content="(.+?)" ?\/>/,
    );
    if (!csrfToken || !csrfToken[1]) {
      throw new Error(
        `Error getting redirect CSRF token: Could not find match in response body`,
      );
    }
    logger.debug("Step 5 success");
    return { traktSession: traktSessionCookie, csrfToken: csrfToken[1] };
  } else {
    logger.debug("Step 2 success");
    return traktSessionCookie;
  }
}

// Step 3: Get CSRF token
async function getCsrfToken(
  traktSession: string,
): Promise<{ traktSession: string; csrfToken: string }> {
  const response = await traktInstance.get("/auth/signin", {
    headers: { Cookie: `_traktsession=${traktSession};` },
  });
  const setCookie = response.headers["set-cookie"];
  const traktSessionCookie = extractCookie(setCookie, "_traktsession");
  const csrfToken = response.data.match(
    /<meta name="csrf-token" content="(.+?)" ?\/>/,
  );
  if (!csrfToken && !csrfToken[1]) {
    throw new Error(
      `Error getting redirect CSRF token: Could not find match in response body`,
    );
  }
  logger.debug("Step 3 success");
  return { traktSession: traktSessionCookie, csrfToken: csrfToken[1] };
}

// Step 4: Sign in to trakt
async function signInTrakt(
  traktSession: string,
  csrfToken: string,
  username: string,
  password: string,
): Promise<string> {
  // URLSearchParams() encodes for application/x-www-form-urlencoded
  const bodyData = new URLSearchParams();
  bodyData.append("authenticity_token", csrfToken);
  bodyData.append("oauth_flow_in_progress", "1");
  bodyData.append("user[login]", username);
  bodyData.append("user[password]", password);

  const response = await traktInstance.post("/auth/signin", bodyData, {
    headers: {
      Cookie: `_traktsession=${traktSession};`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const setCookie = response.headers["set-cookie"];
  const traktSessionCookie = extractCookie(setCookie, "_traktsession");
  if (response.status !== 302) {
    // Success but no redirect = incorrect credentails
    if (response.status === 200) {
      throw new Error(`Incorrect username or password for user ${username}`);
    } else {
      throw new Error("Encountered an error while signing in to Trakt.tv");
    }
  }
  logger.debug("Step 4 success");
  return traktSessionCookie;
}

// Step 6: Authorize and get the final OAuth token
async function authorize(
  redirectUrl: string,
  clientId: string,
  traktSession: string,
  csrfToken: string,
): Promise<string> {
  const bodyData = new URLSearchParams(redirectUrl);

  bodyData.append("authenticity_token", csrfToken);
  bodyData.append("client_id", clientId);
  bodyData.append("redirect_uri", redirectUrl);
  bodyData.append("state", "init");
  bodyData.append("response_type", "code");
  bodyData.append("scope", "public");

  const response = await traktInstance.post("/oauth/authorize", bodyData, {
    headers: {
      Cookie: `_traktsession=${traktSession};`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (response.status !== 302) {
    throw new Error("Encountered an error while performing OAuth Step");
  }
  const location = response.headers.location;
  logger.debug("Step 6 success");
  return location;
}

// Step 7: Acquire a couchmoney logged-in session
async function getCouchmoneySession(url: string): Promise<string> {
  const response = await couchmoneyInstance.get(url);
  if (response.status !== 302) {
    throw new Error(
      "Encountered an error while acquiring couchmoney session - this is likely due to the couchmoney server malfunctioning",
    );
  }
  const setCookieHeader = response.headers["set-cookie"];
  const couchmoneySession = extractCookie(setCookieHeader, "JSESSIONID");
  logger.debug("Step 7 success");
  return couchmoneySession;
}

// Step 8: Trigger sync
async function triggerSync(couchmoneySession: string) {
  const response = await couchmoneyInstance.get("/mylists", {
    headers: {
      Cookie: `JSESSIONID=${couchmoneySession};`,
    },
  });
  if (response.status !== 200) {
    throw new Error("Encountered an error while triggering couchmoney sync");
  }
  logger.debug("Step 8 success");
}

async function startSequence(
  username: string,
  password: string,
): Promise<boolean> {
  logger.debug("Performing sequence for", username);
  try {
    const { redirectUrl, clientId } = await getRedirectUrl();
    let traktSession = await getTraktSession(redirectUrl, clientId);
    let csrfToken = "";
    ({ traktSession, csrfToken } = await getCsrfToken(traktSession));
    traktSession = await signInTrakt(
      traktSession,
      csrfToken,
      username,
      password,
    );
    ({ traktSession, csrfToken } = await getTraktSession(
      redirectUrl,
      clientId,
      traktSession,
    ));
    const finalLocation = await authorize(
      redirectUrl,
      clientId,
      traktSession,
      csrfToken,
    );
    const couchmoneySession = await getCouchmoneySession(finalLocation);
    triggerSync(couchmoneySession);

    return true;
  } catch (error) {
    logger.error(
      `Error performing request sequence for user ${username}:\n`,
      error,
    );
    return false;
  }
}

export default startSequence;
