import { browser } from 'wxt/browser';
import type { Message, Status } from '../../src/messages';
import { settingsItem, type InjectMode } from '../../src/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wpm = $<HTMLInputElement>('wpm');
const accuracy = $<HTMLInputElement>('accuracy');
const mode = $<HTMLSelectElement>('mode');
const toggle = $<HTMLButtonElement>('toggle');
let running = false;

const isChromium = !import.meta.env.FIREFOX && !import.meta.env.SAFARI;
if (!isChromium) mode.querySelector<HTMLOptionElement>('option[value="trusted"]')!.disabled = true;

async function activeTabId() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function send(msg: Message) {
  const id = await activeTabId();
  if (id === undefined) return undefined;
  return browser.tabs.sendMessage(id, msg, { frameId: 0 }).catch(() => undefined);
}

async function sendAllFrames(msg: Message) {
  const id = await activeTabId();
  if (id !== undefined) await browser.tabs.sendMessage(id, msg).catch(() => undefined);
}

function render(status: Status | undefined) {
  const site = $('site');
  const detected = !!status && status.adapter !== 'No text detected';
  site.textContent = status ? (detected ? `Detected: ${status.adapter}` : status.adapter) : 'Page not supported';
  site.classList.toggle('ok', detected);

  running = !!status?.running;
  toggle.textContent = running ? 'Stop typing' : 'Start typing';
  toggle.classList.toggle('running', running);

  const text = running ? `${status!.detail} · ${status!.typed} keys` : status?.detail ?? '';
  $('detail').textContent = text;
  $('status').hidden = !text;
}

async function refresh() {
  render((await send({ type: 'status' })) as Status | undefined);
}

async function save() {
  await settingsItem.setValue({
    wpm: Number(wpm.value),
    accuracy: Number(accuracy.value) / 100,
    mode: mode.value as InjectMode,
  });
  $('wpmOut').textContent = wpm.value;
  $('accOut').textContent = accuracy.value;
}

async function init() {
  const s = await settingsItem.getValue();
  wpm.value = String(s.wpm);
  accuracy.value = String(Math.round(s.accuracy * 100));
  mode.value = s.mode;
  await save();
  for (const el of [wpm, accuracy, mode]) el.addEventListener('input', save);

  toggle.addEventListener('click', async () => {
    // Optional permissions can only be requested from a user gesture, so ask here.
    if (isChromium && mode.value !== 'dom') {
      await browser.permissions.request({ permissions: ['debugger'] as never[] }).catch(() => false);
    }
    await sendAllFrames({ type: running ? 'stop' : 'start' });
    setTimeout(refresh, 150);
  });

  $('pick').addEventListener('click', async () => {
    await send({ type: 'pick' });
    window.close();
  });

  await refresh();
  setInterval(refresh, 500);
}

void init();
