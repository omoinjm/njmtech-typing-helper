/** Worker API base. Override at build time with WXT_API_URL (e.g. http://localhost:8787/api/v1 for `pnpm dev:worker`). */
export const API_URL: string = import.meta.env.WXT_API_URL || 'https://api.typing.njmtech.co.za/api/v1';
