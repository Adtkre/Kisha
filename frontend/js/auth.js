/* ============ Kisha auth helpers ============
   Talks to the real backend in /server. Token is a JWT
   issued by the server after a real bcrypt password check.
*/
const API_BASE_URL = "https://kisha-production.up.railway.app";
const TOKEN_KEY = 'kisha_token';
const USER_KEY = 'kisha_user';
const ADMIN_EMAIL = 'catpin@gmail.com';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch (e) { return null; }
}
function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

/* Wrapper around fetch that adds the auth header and
   automatically bounces to index.html on 401. */
async function authFetch(url, options) {
  options = options || {};
  options.headers = Object.assign({}, options.headers, {
    'Authorization': 'Bearer ' + getToken()
  });
  if (options.body && !(options.headers['Content-Type'])) {
    options.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API_BASE_URL + url, options);
  if (res.status === 401) {
    clearSession();
    window.location.href = 'index.html';
    throw new Error('Not authenticated');
  }
  return res;
}

/* Call at the top of every protected page. Redirects to
   index.html if there's no token, and refreshes the cached
   user object from the server. Returns the user via callback. */
async function requireAuth(onReady) {
  if (!getToken()) {
    window.location.href = 'index.html';
    return;
  }
  try {
    const res = await authFetch('/api/me');
    if (!res.ok) { logout(); return; }
    const data = await res.json();
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    if (onReady) onReady(data.user);
  } catch (e) {
    // authFetch already redirects on 401; for network errors,
    // fall back to the cached user so the page still renders.
    const cached = getStoredUser();
    if (cached && onReady) onReady(cached);
  }
}

function isAdminUser(user) {
  const target = user || getStoredUser();
  if (!target || !target.email) return false;
  return String(target.email).trim().toLowerCase() === ADMIN_EMAIL;
}

function initialsOf(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}
