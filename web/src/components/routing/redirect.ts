/** Where to send the user after login: the page they originally asked for, or the dashboard. */
export function getRedirectTarget(state: unknown): string {
  if (state && typeof state === 'object' && 'from' in state && typeof state.from === 'string') {
    // Only allow in-app paths (never "//evil.com" or "https://...").
    if (state.from.startsWith('/') && !state.from.startsWith('//')) return state.from
  }
  return '/'
}
