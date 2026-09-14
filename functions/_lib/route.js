export function marketingEntryPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  return path === '/' || path === '/index.html' || path === '/index';
}

export function loginEntryPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  return path === '/login' || path === '/login.html' || path === '/signin' || path === '/sign-in' || path === '/log-in';
}

export function shouldRouteToDashboard(session, pathname) {
  if (!session || !session.hasAccount) return false;
  return marketingEntryPath(pathname) || loginEntryPath(pathname);
}
