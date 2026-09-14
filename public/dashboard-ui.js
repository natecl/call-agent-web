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
  window.renderTreenaDashboard = result => {
    const usage = result.usage || {}, billing = result.billing || {};
    const included = number(usage.minutesIncluded ?? billing.minutes);
    const used = number(usage.minutesUsed);
    const remaining = Math.max(0,included-used), extra = Math.max(0,used-included);
    const percentage = included > 0 ? Math.round(used/included*100) : 0;
    const name = result.name || result.firstName || 'Your account';
    fill('[data-profile-name]',name);
    fill('[data-profile-email]',result.email || 'Not available');
    fill('[data-profile-phone]',result.phone || 'Not available');
    fill('[data-profile-initials]',name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase());
    fill('[data-minutes-remaining]',format(remaining));
    fill('[data-minutes-used]',format(used));
    fill('[data-minutes-included]',format(included));
    fill('[data-usage-percent]',`${percentage}% used`);
    fill('[data-overage-minutes]',format(extra));
    fill('[data-overage-cost]',new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(extra*number(billing.overage)));
    const dateLabel = value => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
    };
    fill('[data-renewal]', dateLabel(billing.renewsAt) || 'Renewal date unavailable.');
    fill('[data-next-payment]', dateLabel(billing.renewsAt) || 'Not available');
    const meter = document.querySelector('.meter');
    meter.setAttribute('aria-valuemax',String(included || 1));
    meter.setAttribute('aria-valuenow',String(Math.min(used,included || 1)));
    meter.setAttribute('aria-valuetext',`${format(used)} of ${format(included)} included minutes used`);
    meter.querySelector('span').style.width = `${Math.min(100,percentage)}%`;
    const preference = result.user && result.user.retain_call_artifacts;
    document.querySelector('#dashboard-retain').checked = preference === true || preference === 'on';
  };
})();
