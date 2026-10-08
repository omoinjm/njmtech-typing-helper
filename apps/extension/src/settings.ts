import { storage } from 'wxt/utils/storage';

export type InjectMode = 'auto' | 'dom' | 'trusted';

export interface Settings {
  wpm: number;
  /** 0..1 — probability each letter is typed correctly first time. */
  accuracy: number;
  mode: InjectMode;
}

export const DEFAULT_SETTINGS: Settings = { wpm: 70, accuracy: 0.97, mode: 'auto' };

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});
