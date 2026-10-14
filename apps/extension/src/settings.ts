import { storage } from 'wxt/utils/storage';

export type InjectMode = 'auto' | 'dom' | 'trusted';

/**
 * What the user's own keys do while a run is active:
 * off — pass through to the page (Esc still stops);
 * drive — swallowed, each one types the next correct character instead of the timer;
 * alongside — swallowed so they can't disturb auto-typing;
 * takeover — pass through and pause auto-typing until the user goes idle.
 */
export type UserKeysMode = 'off' | 'drive' | 'alongside' | 'takeover';

export interface Settings {
  wpm: number;
  /** 0..1 — probability each letter is typed correctly first time. */
  accuracy: number;
  mode: InjectMode;
  /** Optional: settings stored before v0.2.0 don't have it; read as `?? 'off'`. */
  userKeys?: UserKeysMode;
}

export const DEFAULT_SETTINGS: Settings = { wpm: 70, accuracy: 0.97, mode: 'auto', userKeys: 'off' };

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});
