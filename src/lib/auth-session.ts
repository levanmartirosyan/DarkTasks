const SESSION_KEY = "darktasks.session";

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY);
}

export function saveSessionToken(token: string) {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY);
}

export function hasSessionToken() {
  return Boolean(getSessionToken());
}
