require("dotenv").config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  topGaragesChannelId: process.env.TOP_GARAGES_CHANNEL_ID || null
};
