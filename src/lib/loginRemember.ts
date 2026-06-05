const STORAGE_KEY = "orderflow_remember_login";

export type SavedLogin = {
  email: string;
  password: string;
};

export function loadSavedLogin(): SavedLogin | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLogin>;
    if (typeof parsed.email === "string" && parsed.email.trim()) {
      return {
        email: parsed.email.trim(),
        password: typeof parsed.password === "string" ? parsed.password : "",
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function saveLogin(email: string, password: string) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ email: email.trim(), password }),
  );
}

export function clearSavedLogin() {
  localStorage.removeItem(STORAGE_KEY);
}
