@echo off
setlocal

REM Starts the API + static site (production mode) without Vite dev middleware.
set NODE_ENV=production

echo Starting server on http://localhost:5000 ...
node --experimental-strip-types server.ts

endlocal
