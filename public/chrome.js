// Shared landing chrome for inner pages. Home keeps app.js unchanged.
const RELAY_MESSAGE_URL = '';
const dialog = document.getElementById('contact-dialog');
document.querySelectorAll('.text-relay').forEach((button) => {
  button.addEventListener('click', () => {
    if (RELAY_MESSAGE_URL) location.href = RELAY_MESSAGE_URL;
    else dialog.showModal();
  });
});
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => {
  if (e.target !== dialog) return;
  const b = dialog.getBoundingClientRect();
  if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close();
});
document.getElementById('dialog-demo').addEventListener('click', () => {
  dialog.close();
  location.href = 'index.html#how-it-works';
});
