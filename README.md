# SaveSense — Full-featured Savings Tracker

A responsive personal finance tracker built with Node.js, Express, HTML, CSS and vanilla JavaScript. Uses a local JSON data file, avoiding native database modules and the `better-sqlite3`/`node-gyp` installation issue.

## Features
- Dashboard with current balance, monthly income, expenses and savings
- Add, edit, delete, search and filter transactions
- Income, expense and savings transaction types
- Savings goals, progress indicators and contributions
- Monthly category budgets with overspending alerts
- Cash-flow and spending charts
- Reports and automatically generated insights
- CSV export and full JSON backup/restore
- Currency preference and monthly income setting
- Responsive layout for desktop, tablet and mobile
- Input validation and JSON API endpoints

## Requirements
- Node.js 18 or newer
- Internet connection during `npm install` for Express; charts and web fonts load from CDNs.

## Run on Windows
1. Extract the ZIP.
2. Open the `savesense-tracker` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```powershell
   npm install
   npm start
   ```

5. Open http://localhost:3000

Stop the server with `Ctrl+C`.

## Data storage
The app creates `data/store.json` on first launch. Keep a backup using Settings → Download full backup. Do not delete the `data` folder if you want to keep your records.

## Restore a backup
Use Settings → Restore from backup and select a previously downloaded SaveSense JSON backup. Restoring replaces the current local data.

## API
- `GET /api/state`
- `PATCH /api/settings`
- `POST /api/transactions`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `POST /api/goals`
- `PATCH /api/goals/:id/contribute`
- `DELETE /api/goals/:id`
- `PUT /api/budgets/:month/:category`
- `DELETE /api/budgets/:id`
- `GET /api/export`
- `GET /api/health`

## Important
This is a local, single-user project/demo. It does not have login, cloud synchronization, encryption, or multi-user separation. Keep it on your own computer and do not expose it to the public internet with real financial data without adding authentication and appropriate security controls.
