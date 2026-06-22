// Wraps fetch with an AbortController timeout
export function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Races any promise against a timeout, resolving to fallback on expiry
export function withTimeout(promise, ms = 6000, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}
