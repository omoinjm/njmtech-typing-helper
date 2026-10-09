import type { SiteRule } from '../env';

/** Bump whenever SITE_RULES changes so clients can tell they have the latest set. */
export const SITE_RULES_VERSION = '2026-10-08.2';

export const SITE_RULES: SiteRule[] = [
  { hosts: ['monkeytype.com'], name: 'Monkeytype', container: '#words', target: '#wordsInput' },
  { hosts: ['10fastfingers.com'], name: '10FastFingers', container: '[data-testid="word-box-words"]', target: 'main textarea', prefersTrusted: true },
  { hosts: ['typeracer.com'], name: 'TypeRacer', container: '.inputPanel', target: 'input.txtInput', prefersTrusted: true },
  { hosts: ['keybr.com'], name: 'Keybr', prefersTrusted: true },
  { hosts: ['typing.com'], name: 'Typing.com', prefersTrusted: true },
  { hosts: ['typingclub.com', 'edclub.com'], name: 'TypingClub', prefersTrusted: true },
  { hosts: ['ratatype.com'], name: 'Ratatype', prefersTrusted: true },
];
