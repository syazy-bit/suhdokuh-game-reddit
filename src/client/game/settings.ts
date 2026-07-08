export interface Settings {
  autoAdvanceCursor: boolean;
  autoClearNotes: boolean;
  highlightRelatedCells: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoAdvanceCursor: true,
  autoClearNotes: true,
  highlightRelatedCells: true,
};

export const SETTINGS_STORAGE_KEY = "suhdokuh.settings";

let currentSettings: Settings = loadSettingsInternal();

function loadSettingsInternal(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_SETTINGS };
    }
    const record = parsed as Record<string, unknown>;
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const value = record[key];
      if (typeof value === "boolean") {
        settings[key] = value;
      }
    }
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {
    // Storage unavailable — silently fail.
  }
}

export function loadSettings(): Settings {
  currentSettings = loadSettingsInternal();
  return { ...currentSettings };
}

export function getSettings(): Settings {
  return { ...currentSettings };
}

export function saveSettings(): void {
  persistSettings();
}

export function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Settings {
  currentSettings = { ...currentSettings, [key]: value };
  persistSettings();
  return { ...currentSettings };
}
