export interface Status {
  running: boolean;
  adapter: string;
  detail: string;
  typed: number;
}

export type Message =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'toggle' }
  | { type: 'pick' }
  | { type: 'status' }
  | { type: 'trusted:attach' }
  | { type: 'trusted:detach' }
  /** `\b` means Backspace. */
  | { type: 'trusted:key'; ch: string };
