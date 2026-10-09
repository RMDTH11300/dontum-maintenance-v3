/** Public client-side settings ONLY. NEVER put tokens or shared secrets here. */
window.DONTUM_CONFIG = {
  // Paste the existing LIFF ID from LINE Developers > LIFF > DONTUM REPAIR.
  liffId: '2011951322-IPcMHOm6',
  // Existing Cloudflare Worker URL — keep /api paths in app.js (do not add /webhook here).
  apiBase: 'https://dontum-line-webhook.mulberryleaf25.workers.dev'
};
