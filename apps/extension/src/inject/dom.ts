import type { Injector } from '../engine/typer';
import { BACKSPACE, keyFor, type KeyInfo } from './keys';

type Editable = HTMLInputElement | HTMLTextAreaElement;

function isTextControl(el: Element | null): el is Editable {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && /^(text|search|url|tel|)$/i.test(el.type));
}

function isEditable(el: Element | null): el is HTMLElement {
  return isTextControl(el) || (el instanceof HTMLElement && el.isContentEditable);
}

function keyEvent(type: string, k: KeyInfo): KeyboardEvent {
  // keyCode/which aren't in the standard init dict but Chromium honours them.
  return new KeyboardEvent(type, {
    key: k.key,
    code: k.code,
    keyCode: k.keyCode,
    which: k.keyCode,
    charCode: type === 'keypress' ? k.text.charCodeAt(0) : 0,
    shiftKey: k.shift,
    bubbles: true,
    cancelable: true,
    composed: true,
  } as KeyboardEventInit);
}

/** Set a control's value through the prototype setter so React/Vue trackers see a change. */
function setNativeValue(el: Editable, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
}

function fallbackEdit(el: HTMLElement, inputType: 'insertText' | 'deleteContentBackward', data: string | null) {
  const before = new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true, composed: true });
  if (!el.dispatchEvent(before)) return;
  if (isTextControl(el)) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    let next: string;
    let caret: number;
    if (inputType === 'insertText') {
      next = el.value.slice(0, start) + data + el.value.slice(end);
      caret = start + data!.length;
    } else {
      const from = start === end ? Math.max(0, start - 1) : start;
      next = el.value.slice(0, from) + el.value.slice(end);
      caret = from;
    }
    setNativeValue(el, next);
    el.setSelectionRange?.(caret, caret);
  } else if (inputType === 'insertText') {
    el.append(data!);
  } else {
    el.textContent = (el.textContent ?? '').slice(0, -1);
  }
  el.dispatchEvent(new InputEvent('input', { inputType, data, bubbles: true, composed: true }));
}

/**
 * Edit via execCommand first: it fires real (trusted) beforeinput/input events and
 * goes through the browser's own editing path, which most sites accept.
 */
function edit(el: HTMLElement, inputType: 'insertText' | 'deleteContentBackward', data: string | null) {
  if (document.activeElement === el && typeof document.execCommand === 'function') {
    const ok =
      inputType === 'insertText'
        ? document.execCommand('insertText', false, data!)
        : document.execCommand('delete', false);
    if (ok) return;
  }
  fallbackEdit(el, inputType, data);
}

/**
 * Synthetic keyboard + input events. Works everywhere, but keydown/keyup have
 * isTrusted=false — sites that check that need the debugger injector.
 */
export class DomInjector implements Injector {
  constructor(private getTarget: () => HTMLElement | null) {}

  private target(): HTMLElement {
    const t = this.getTarget() ?? (document.activeElement as HTMLElement | null) ?? document.body;
    if (document.activeElement !== t && t !== document.body) t.focus({ preventScroll: true });
    return t;
  }

  private press(k: KeyInfo, applyEdit: (el: HTMLElement) => void) {
    const el = this.target();
    const proceed = el.dispatchEvent(keyEvent('keydown', k));
    if (proceed && k.text && k.key !== 'Backspace') el.dispatchEvent(keyEvent('keypress', k));
    if (proceed && isEditable(el)) applyEdit(el);
    el.dispatchEvent(keyEvent('keyup', k));
  }

  async type(ch: string) {
    const k = keyFor(ch);
    this.press(k, (el) => edit(el, 'insertText', ch));
  }

  async backspace() {
    this.press(BACKSPACE, (el) => edit(el, 'deleteContentBackward', null));
  }
}
