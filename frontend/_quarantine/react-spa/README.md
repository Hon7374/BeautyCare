This folder quarantines the unfinished React/JSX SPA prototype.

Official frontend for the thesis demo is the static HTML/CSS/JS app under:

- `frontend/*.html`
- `frontend/user/*.html`
- `frontend/admin/*.html`
- `frontend/js/*.js`

Reasons this code is quarantined instead of used:

- there is no dedicated `frontend/package.json`
- the SPA routes/imports are incomplete
- the thesis demo runbook uses `node backend/server.js` and serves the static frontend directly

Do not use this folder for the main demo unless the React frontend is completed and documented separately.
