import axios from "axios";

function validateStatusFunc(status: number): boolean {
  return status >= 200 && status < 500; // only error on server error
}

const couchmoneyInstance = axios.create({
  baseURL: "https://couchmoney.tv",
  timeout: 5000,
  maxRedirects: 0,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  },
  validateStatus: validateStatusFunc,
});

const traktInstance = axios.create({
  baseURL: "https://trakt.tv",
  timeout: 5000,
  maxRedirects: 0,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  },
  validateStatus: validateStatusFunc,
});

export { couchmoneyInstance, traktInstance };
