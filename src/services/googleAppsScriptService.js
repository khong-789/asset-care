export const GOOGLE_APPS_SCRIPT_WEB_APP_URL = (import.meta.env.VITE_APPS_SCRIPT_URL || "").trim();
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");

const ensureConfigured = () => {
  if (!GOOGLE_APPS_SCRIPT_WEB_APP_URL) {
    throw new Error("Google Apps Script Web App URL is not configured");
  }
};

const parseResponse = async (response) => {
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Apps Script did not return JSON");
  }
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Apps Script request failed");
  }
  return result.data;
};

export const apiGet = async (action, params = {}) => {
  ensureConfigured();
  const url = new URL(GOOGLE_APPS_SCRIPT_WEB_APP_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  const response = await fetch(url.toString(), { method: "GET" });
  return parseResponse(response);
};

export const apiPost = async (action, payload = {}) => {
  ensureConfigured();
  const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ action, ...payload })
  });
  return parseResponse(response);
};

export const login = (username, password) => apiPost("login", { username, password });
export const getAssets = () => apiGet("getAssets");
export const getAssetById = (id) => apiGet("getAssetById", { id });
export const getUsers = () => apiGet("getUsers");
export const createAsset = (asset) => apiPost("createAsset", { asset });
export const updateAsset = (id, updates) => apiPost("updateAsset", { id, updates });
export const deleteAsset = (id) => apiPost("deleteAsset", { id });
export const getHistoryLogs = () => apiGet("getHistoryLogs");
export const createHistoryLog = (log) => apiPost("createHistoryLog", { log });
export const getSettings = () => apiGet("getSettings");
export const updateSettings = (settings) => apiPost("updateSettings", { settings });
export const seedInitialData = () => apiPost("seedInitialData");

export const isAppsScriptConfigured = () => Boolean(GOOGLE_APPS_SCRIPT_WEB_APP_URL);
