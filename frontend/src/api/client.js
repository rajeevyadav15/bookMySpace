const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const TOKEN_KEY = "bms_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    // storage blocked, app still works for this session
  }
}

export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function api(path, { method = "GET", body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "Cannot reach server. Is the backend running?");
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    // response had no JSON body
  }

  if (!res.ok) {
    // Token expired or invalid: log the user out everywhere
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(
      res.status,
      (data && data.message) || "Something went wrong",
      data && data.errors
    );
  }

  return data;
}