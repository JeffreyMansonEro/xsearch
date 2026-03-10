import { AccountGroup } from "@/types";

const STORAGE_KEY = "xsearch_settings";

interface SettingsData {
  apiKey: string;
  groups: AccountGroup[];
}

function getSettings(): SettingsData {
  if (typeof window === "undefined") return { apiKey: "", groups: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { apiKey: "", groups: [] };
    const parsed = JSON.parse(raw);
    return {
      apiKey: parsed.apiKey ?? "",
      groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    };
  } catch {
    return { apiKey: "", groups: [] };
  }
}

function saveSettings(data: Partial<SettingsData>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSettings();
    const updated = { ...current, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable
  }
}

export function loadSettings(): { apiKey: string; groups: AccountGroup[] } {
  return getSettings();
}

export function saveApiKey(key: string): void {
  saveSettings({ apiKey: key });
}

export function saveGroups(groups: AccountGroup[]): void {
  saveSettings({ groups });
}

export function generateId(): string {
  return crypto.randomUUID();
}
