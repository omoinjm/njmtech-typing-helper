let host: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Small status bubble in a shadow root so page CSS can't touch it. */
export function toast(message: string, ms = 2500) {
  if (!host) {
    host = document.createElement('njm-typing-helper-toast');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      div{position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;padding:10px 14px;
      border-radius:8px;border:1px solid rgba(249,115,22,.25);background:#0a0a0a;color:#fdba74;
      font:13px/1.4 Arial,Helvetica,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:opacity .2s}
    </style><div></div>`;
    document.documentElement.append(host);
  }
  const box = host.shadowRoot!.querySelector('div')!;
  box.textContent = message;
  box.style.opacity = '1';
  clearTimeout(timer);
  if (ms > 0) timer = setTimeout(() => (box.style.opacity = '0'), ms);
}
