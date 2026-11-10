"use client";

// The family passcode is kept in this browser's localStorage and sent as a header
// on every call to our own /api routes. It is never sent anywhere else.
const STORAGE_KEY = "study-buddy-passcode";
const HEADER = "x-family-passcode";

export function getPasscode(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
export function setPasscode(value: string) {
  try {
    if (value.trim()) window.localStorage.setItem(STORAGE_KEY, value.trim());
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode): the passcode just will not be remembered */
  }
}

/** fetch() for our own API routes, with the passcode header attached. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const code = getPasscode();
  if (code) headers.set(HEADER, code);
  return fetch(path, { ...init, headers });
}
