# Vehicle Life Bot — Free Render + MongoDB + Vehicle Images

This version keeps player/vehicle progress in MongoDB and includes **34 vehicle images** in `assets/vehicles/`.

## Vehicle images

All 34 vehicles have a bundled PNG image. `/profile` shows the user's current vehicle image. `/garage` shows owned vehicles with their images and **Previous / Next** buttons so the full collection can be viewed on mobile.

The image files are bundled with the bot, so no external image hosting is required.

## Render deployment

Use a **Background Worker** on Render. Keep the repository **Root Directory blank** because `package.json` and `src/` are at the repository root.

Build command:

```text
npm install
```

Start command:

```text
npm start
```

## Render environment variables

Set these variables in the Render service:

- `DISCORD_TOKEN` — your Discord bot token
- `CLIENT_ID` — your Discord Application ID
- `GUILD_ID` — your Discord server ID (optional for global commands)
- `TOP_GARAGES_CHANNEL_ID` — optional
- `MONGODB_URI` — your MongoDB Atlas Node.js driver connection string
- `MONGODB_DB` — `vehiclelife`

Do not commit `MONGODB_URI` to GitHub. Keep it in Render Environment Variables.

## MongoDB Atlas

Create a free MongoDB Atlas cluster, create a database user, allow the Render service to connect, then use **Connect → Drivers → Node.js** and copy the connection string. Replace the password placeholder with your database user's password.

The app stores player records in the `users` collection.

## Commands

- `/profile` — current vehicle + current vehicle image + progress
- `/garage` — owned vehicle images with pagination
- `/topgarages` — leaderboard
- `/setup` — configure the current channel for the leaderboard
