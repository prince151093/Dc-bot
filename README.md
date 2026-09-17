# Vehicle Life Bot

Discord.js Vehicle Life bot that unlocks vehicles from messages and voice-chat time.

## Render deployment

Deploy this repository as a **Background Worker** on Render.

Build command:
`npm install`

Start command:
`npm start`

Required environment variables:
- `DISCORD_TOKEN` — Discord bot token (keep secret)
- `CLIENT_ID` — Discord application ID
- `GUILD_ID` — server ID (optional; if set, commands register to that server immediately)
- `TOP_GARAGES_CHANNEL_ID` — optional channel ID
- `DB_PATH` — optional JSON database path; defaults to `vehicle-life.json`

This version intentionally avoids native SQLite dependencies so Render does not need to compile `better-sqlite3`.

## Local run

```bash
npm install
npm start
```
