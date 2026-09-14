// Dashboard presentation only. Session verification remains in checkout.js.
(() => {
  const names = {plan:'Plan & usage', settings:'Settings', privacy:'Privacy', profile:'Profile'};
  function renderView() {
    const key = location.hash.slice(1);
    const active = names[key] ? key : 'plan';
    document.querySelectorAll('.account-view').forEach(panel => { panel.hidden = panel.id !== `${active}-view`; });
    document.querySelector('#breadcrumb').textContent = names[active];
    document.querySelectorAll('[data-view]').forEach(link => {
      if (link.dataset.view === active) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }
  addEventListener('hashchange', renderView);
  renderView();
  const fill = (selector,value) => document.querySelectorAll(selector).forEach(el => { el.textContent = String(value); });
  const number = value => Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : 0;
  const format = value => new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
  const show = (selector, visible) => document.querySelectorAll(selector).forEach(el => { el.hidden = !visible; });
  window.renderTreenaDashboard = result => {
    const usage = result.usage || {}, billing = result.billing || {}, pack = usage.pack || {};
    const included = number(usage.minutesIncluded ?? billing.minutes);
    const used = number(usage.minutesUsed);
    const prepaid = number(usage.prepaidMinutes);
    const remaining = number(usage.minutesRemaining ?? Math.max(0, included + prepaid - used));
    const state = usage.state || (remaining <= 0 ? 'at_cap' : remaining <= 5 ? 'approaching' : 'ok');
    const percentage = included > 0 ? Math.min(100, Math.round(used / included * 100)) : 0;
    const name = result.name || result.firstName || 'Your account';
    fill('[data-profile-name]',name);
    fill('[data-profile-email]',result.email || 'Not available');
    fill('[data-profile-phone]',result.phone || 'Not available');
    fill('[data-profile-initials]',name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase());
    fill('[data-minutes-remaining]',format(remaining));
    fill('[data-minutes-used]',format(used));
    fill('[data-minutes-included]',format(included));
    fill('[data-usage-percent]',`${percentage}% used`);
    fill('[data-prepaid-minutes]',format(prepaid));
    fill('[data-packs-used]',String(pack.packsUsed ?? Math.min(12, Math.floor(prepaid / 5))));
    fill('[data-remaining-label]', state === 'at_cap' ? 'At your minute cap' : 'Remaining this month');
    const dateLabel = value => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
    };
    fill('[data-renewal]', dateLabel(billing.renewsAt) || 'Renewal date unavailable.');
    fill('[data-next-payment]', dateLabel(billing.renewsAt) || 'Not available');
    const resetLabel = dateLabel(billing.minutesResetAt);
    if (resetLabel) fill('[data-reset-date]', `Resets ${resetLabel}`);
    const panel = document.querySelector('#usage');
    if (panel) panel.setAttribute('data-usage-state', state);
    const meter = document.querySelector('.meter');
    if (meter) {
      meter.setAttribute('aria-valuemax',String(included || 1));
      meter.setAttribute('aria-valuenow',String(Math.min(used, included || 1)));
      meter.setAttribute('aria-valuetext',`${format(used)} of ${format(included)} included minutes used`);
      const bar = meter.querySelector('span');
      if (bar) bar.style.width = `${Math.min(100,percentage)}%`;
    }
    const banner = document.querySelector('[data-cap-banner]');
    if (banner) {
      const note = usage.usageNote || '';
      const showBanner = state === 'at_cap' || state === 'approaching';
      banner.hidden = !showBanner;
      if (showBanner) banner.textContent = note;
    }
    show('[data-prepaid-row]', prepaid > 0);
    const buy = document.querySelector('#buy-pack');
    if (buy) {
      buy.disabled = pack.canPurchase === false;
      buy.setAttribute('aria-disabled', pack.canPurchase === false ? 'true' : 'false');
    }
    const gated = document.querySelector('[data-pack-gated]');
    if (gated) {
      gated.hidden = !pack.gatedReason;
      gated.textContent = pack.gatedReason || '';
    }
    const recorded = document.querySelector('[data-pack-recorded]');
    if (recorded) {
      const packOk = String(location.search || '').includes('pack=ok');
      recorded.hidden = !(packOk && state === 'at_cap');
    }
    const settingsRetain = result.settings && result.settings.retainAfterCall;
    const flyRetain = result.user && result.user.retain_call_artifacts;
    const on = settingsRetain === 'on' || settingsRetain === true
      || ((settingsRetain == null || settingsRetain === '') && (flyRetain === true || flyRetain === 'on'));
    const retain = document.querySelector('#dashboard-retain');
    if (retain) {
      retain.checked = on;
      retain.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    fill('#privacy-retain-heading', on ? 'Saving is on' : 'Off by default');
  };
})();
