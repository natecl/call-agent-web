// Shared landing chrome for inner pages. Home keeps app.js unchanged.
const dialog = document.getElementById('contact-dialog');
function messageUrl() {
  return window.TREENA_MESSAGE_URL || 'sms:+12138653024';
}
document.querySelectorAll('.text-relay').forEach((button) => {
  button.addEventListener('click', (event) => {
    const url = messageUrl();
    if (url) {
      if (button.tagName === 'A') return;
      event.preventDefault();
      location.href = url;
      return;
    }
    event.preventDefault();
    if (dialog) dialog.showModal();
  });
});
if (dialog) {
  const close = document.querySelector('.dialog-close');
  if (close) close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const b = dialog.getBoundingClientRect();
    if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close();
  });
  const demo = document.getElementById('dialog-demo');
  if (demo) {
    demo.addEventListener('click', () => {
      dialog.close();
      location.href = new URL('index.html#how-it-works', document.querySelector('.brand').href).href;
    });
  }
}
fetch('/api/config').then((res) => res.json()).then((cfg) => {
  if (!cfg || !cfg.imessage || !cfg.imessage.smsUrl) return;
  window.TREENA_IMESSAGE_E164 = cfg.imessage.e164;
  window.TREENA_MESSAGE_URL = cfg.imessage.smsUrl;
  document.querySelectorAll('a.text-relay').forEach((a) => { a.href = cfg.imessage.smsUrl; });
}).catch(() => {});
