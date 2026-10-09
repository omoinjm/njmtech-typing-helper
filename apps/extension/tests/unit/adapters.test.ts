import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickAdapter } from '../../src/adapters';
import { createGenericAdapter } from '../../src/adapters/generic';
import { DomInjector } from '../../src/inject/dom';
import { tenFastFingers } from '../../src/adapters/tenfastfingers';

const createTenFF = () => tenFastFingers.create();

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '../fixtures', name), 'utf8');
// innerHTML doesn't execute <script>, so run fixture scripts by hand.
const load = (name: string) => {
  document.documentElement.innerHTML = fixture(name).replace(/^[\s\S]*?<html[^>]*>|<\/html>[\s\S]*$/g, '');
  for (const s of document.querySelectorAll('script')) new Function(s.textContent ?? '')();
};

describe('Monkeytype adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="pageTest"><input id="wordsInput"><div id="words">
        <div class="word typed"><letter class="correct">h</letter><letter class="correct">i</letter></div>
        <div class="word active"><letter class="correct">t</letter><letter>h</letter><letter>e</letter><letter>m</letter></div>
        <div class="word"><letter>a</letter><letter>l</letter><letter>l</letter></div>
      </div><div id="result" class="hidden"></div></div>`;
  });

  it('is chosen on monkeytype.com and reads remaining text from the active word', () => {
    const a = pickAdapter('monkeytype.com', null);
    expect(a.id).toBe('monkeytype');
    expect(a.remaining()).toBe('hem all');
    expect(a.target()?.id).toBe('wordsInput');
    expect(a.isFinished?.()).toBe(false);
  });
});

describe('10FastFingers adapter', () => {
  // Markup captured from the live site (2026 redesign), class hash shortened.
  const box = (spans: string) =>
    `<main><div data-testid="word-box-words">${spans}</div><textarea></textarea></main>`;

  it('reads from the caret span in the redesigned layout and prefers trusted keys', () => {
    document.body.innerHTML = box(
      `<span class="wb-x-t">against</span><span class="wb-x-t"> </span>` +
        `<span class="wb-x-aw wb-x-ac">n</span><span class="wb-x-aw">o</span><span class="wb-x-aw"> </span>` +
        `<span>because</span><span> </span>`,
    );
    const a = pickAdapter('10fastfingers.com', null);
    expect(a.id).toBe('10fastfingers');
    expect(a.prefersTrusted).toBe(true);
    expect(a.remaining()).toBe('no because ');
    expect(a.target()?.tagName).toBe('TEXTAREA');
  });

  it('treats a caret on a mistake the same way (remaining starts at the caret)', () => {
    document.body.innerHTML = box(
      `<span class="wb-x-aw wb-x-t">a</span><span class="wb-x-aw wb-x-e">g</span>` +
        `<span class="wb-x-aw wb-x-ac">a</span><span class="wb-x-aw">inst</span>`,
    );
    expect(pickAdapter('10fastfingers.com', null).remaining()).toBe('ainst');
  });

  it('reports done when typed runs remain but the caret is gone', () => {
    document.body.innerHTML = box(`<span class="wb-x-t">against</span><span class="wb-x-t"> </span>`);
    expect(createTenFF().remaining()).toBe('');
  });

  it('still supports the legacy #row1 layout', () => {
    document.body.innerHTML = `<div id="row1"><span wordnr="0" class="correct">we</span>
      <span wordnr="1" class="highlight">could</span><span wordnr="2">go</span></div><input id="inputfield" value="co">`;
    const a = pickAdapter('10fastfingers.com', null);
    expect(a.id).toBe('10fastfingers');
    expect(a.remaining()).toBe('uld go');
  });
});

describe('generic adapter', () => {
  it('reads char spans and progress from class markers', () => {
    load('char-spans.html');
    const a = createGenericAdapter();
    expect(a.snapshot()).toBe('Pack my box with five dozen liquor jugs.');
    expect(a.remaining()).toBeNull(); // no markers yet → snapshot mode
    document.querySelectorAll('#text span')[0]!.className = 'char typed';
    document.querySelectorAll('#text span')[1]!.className = 'char current';
    expect(a.remaining()).toBe('ack my box with five dozen liquor jugs.');
  });

  it('inserts spaces between word groups and ignores on-screen keyboards', () => {
    load('word-groups.html');
    const a = createGenericAdapter();
    expect(a.snapshot()).toBe('sphinx of black quartz judge my vow');
  });

  it('falls back to plain text of a picked element', () => {
    document.body.innerHTML = `<p id="p">  Some   plain text </p>`;
    const a = createGenericAdapter({ root: () => document.getElementById('p') });
    expect(a.remaining()).toBeNull();
    expect(a.snapshot()).toBe('Some plain text');
  });
});

describe('remote site rules', () => {
  it('fall back to a rule container when the built-in adapter finds nothing', () => {
    document.body.innerHTML = `<div id="passage"><span>a</span><span>b</span><span> </span><span>c</span></div><textarea id="t"></textarea>`;
    const rules = [{ hosts: ['example.org'], name: 'Example', container: '#passage', target: '#t', prefersTrusted: true }];
    const a = pickAdapter('www.example.org', null, rules);
    expect(a.name).toBe('Example');
    expect(a.prefersTrusted).toBe(true);
    expect(a.snapshot()).toBe('ab c');
    expect(a.target()?.id).toBe('t');
  });

  it('refreshSiteRules keeps the cache when the API is down', async () => {
    const { refreshSiteRules } = await import('../../src/site-rules');
    expect(await refreshSiteRules((async () => new Response('', { status: 503 })) as typeof fetch)).toBe(false);
    expect(await refreshSiteRules((async () => { throw new Error('offline'); }) as typeof fetch)).toBe(false);
  });
});

describe('DomInjector', () => {
  it('fires key events and updates a React-style controlled input', async () => {
    document.body.innerHTML = `<input id="i">`;
    const input = document.getElementById('i') as HTMLInputElement;
    const seen: string[] = [];
    for (const t of ['keydown', 'keypress', 'beforeinput', 'input', 'keyup']) input.addEventListener(t, () => seen.push(t));
    const inj = new DomInjector(() => input);
    await inj.type('h');
    await inj.type('i');
    await inj.backspace();
    expect(input.value).toBe('h');
    expect(seen.slice(0, 5)).toEqual(['keydown', 'keypress', 'beforeinput', 'input', 'keyup']);
  });

  it('respects preventDefault on keydown', async () => {
    document.body.innerHTML = `<input id="i">`;
    const input = document.getElementById('i') as HTMLInputElement;
    input.addEventListener('keydown', (e) => e.preventDefault());
    await new DomInjector(() => input).type('x');
    expect(input.value).toBe('');
  });
});
