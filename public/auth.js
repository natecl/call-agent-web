(function () {
  const DEFAULT_NEXT = '/account.html?plan=personal';

  function storedPlan() {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan === 'personal' || plan === 'plus') return plan;
    try {
      const stored = sessionStorage.getItem('treena-plan');
      if (stored === 'personal' || stored === 'plus') return stored;
    } catch (_) {}
    return 'personal';
  }

  function nextPath() {
    const plan = storedPlan();
    if (plan === 'personal' || plan === 'plus') return `/account.html?plan=${encodeURIComponent(plan)}`;
    return DEFAULT_NEXT;
  }

  function payPath() {
    const plan = storedPlan();
    return `/pay.html?plan=${encodeURIComponent(plan)}`;
  }

  function showError(message, missing) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    const extra = missing && missing.length ? ` Missing: ${missing.join(', ')}.` : '';
    el.hidden = !message;
    el.textContent = message ? `${message}${extra}` : '';
  }

  function applyMissing(oauth) {
    const note = document.getElementById('oauth-config-note');
    if (!note || !oauth) return;
    const missing = [];
    if (oauth.missing && oauth.missing.google && oauth.missing.google.length) {
      missing.push(`Google: ${oauth.missing.google.join(', ')}`);
    }
    if (oauth.missing && oauth.missing.apple && oauth.missing.apple.length) {
      missing.push(`Apple: ${oauth.missing.apple.join(', ')}`);
    }
    if (!missing.length) {
      note.hidden = true;
      note.textContent = '';
      return;
    }
    note.hidden = false;
    note.textContent = `Sign-in with Google/Apple is blocked until ops set ${missing.join(' · ')}.`;
  }

  const params = new URLSearchParams(location.search);
  const queryError = params.get('auth_error');
  const queryMissing = (params.get('missing') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (queryError) showError(queryError, queryMissing);

  document.querySelectorAll('[data-oauth]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const provider = button.getAttribute('data-oauth');
      if (provider !== 'google' && provider !== 'apple') return;
      location.href = `/api/auth/${provider}?next=${encodeURIComponent(nextPath())}`;
    });
  });

  fetch('/api/config')
    .then((res) => res.json())
    .then((cfg) => applyMissing(cfg.oauth))
    .catch(() => {});

  const page = document.body.getAttribute('data-page');

  fetch('/api/auth/me')
    .then((res) => res.json())
    .then((me) => {
      if (!me || !me.signedIn) return;
      if (me.hasAccount) {
        location.replace('/dashboard');
        return;
      }
      try {
        if (me.email) sessionStorage.setItem('treena-email', me.email);
        if (me.name) sessionStorage.setItem('treena-name', me.name);
        if (me.phone) sessionStorage.setItem('treena-phone', me.phone);
        sessionStorage.setItem('treena-plan', storedPlan());
      } catch (_) {}
      if (page === 'account' || page === 'login') {
        location.replace(payPath());
        return;
      }
      const email = document.getElementById('email');
      if (email && me.email) email.value = me.email;
      const passwordField = document.getElementById('password-field') || document.getElementById('password')?.closest('.field');
      const password = document.getElementById('password');
      if (password) {
        password.required = false;
        password.disabled = true;
        password.value = '';
        password.placeholder = 'Signed in with ' + (me.provider || 'OAuth');
      }
      if (passwordField) passwordField.hidden = true;
      const signed = document.getElementById('oauth-signed-in');
      if (signed) {
        signed.hidden = false;
        signed.textContent = `Signed in with ${me.provider || 'OAuth'} as ${me.email}.`;
      }
    })
    .catch(() => {});
})();
