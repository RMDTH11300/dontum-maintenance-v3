/** Public client-side settings ONLY. NEVER put tokens or shared secrets here. */
window.DONTUM_CONFIG = {
  // Paste the existing LIFF ID from LINE Developers > LIFF > DONTUM REPAIR.
  liffId: 'PASTE_YOUR_LIFF_ID',
  // Existing Cloudflare Worker URL — keep /api paths in app.js (do not add /webhook here).
  apiBase: 'https://dontum-line-webhook.mulberryleaf25.workers.dev'
};
