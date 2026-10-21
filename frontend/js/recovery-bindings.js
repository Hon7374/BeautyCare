// The recovery pages intentionally do not load auth.js. Bind their controls
// here, after recovery.js has defined the recovery functions.
document.addEventListener('DOMContentLoaded', () => {
  const resetButton = document.getElementById('btnDoReset');
  if (resetButton && typeof doResetPassword === 'function') {
    resetButton.addEventListener('click', () => {
      void doResetPassword();
    });
  }

  const sendResetButton = document.getElementById('btnSendReset');
  if (sendResetButton && typeof sendResetLink === 'function') {
    sendResetButton.addEventListener('click', () => {
      void sendResetLink();
    });
  }
});
