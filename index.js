const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const config = require("./config");
const { vehicles } = require("./vehicles");
const {
  getUser,
  addMessage,
  addVcSeconds,
  setVcJoin,
  clearVcJoin,
  setVehicleIndex,
  topUsers,
  close: closeDb,
  init: initDb
} = require("./db");
const { profileEmbed, profileFiles, garagePage, topGaragesEmbed } = require("./cards");

if (!config.token) {
  console.error("Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}
if (!config.clientId) {
  console.error("Missing CLIENT_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your Vehicle Life profile"),
  new SlashCommandBuilder()
    .setName("garage")
    .setDescription("View your complete vehicle collection"),
  new SlashCommandBuilder()
    .setName("topgarages")
    .setDescription("Refresh the Top Garages leaderboard"),
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set the current channel as the Top Garages channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

async function deployCommands() {
  const rest = new REST({ version: "10" }).setToken(config.token);
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log("Guild slash commands registered.");
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log("Global slash commands registered.");
  }
}

async function checkUnlocks(guild, userId) {
  const user = getUser(userId, guild.id);
  let unlocked = [];
  let index = user.vehicle_index;

  while (index < vehicles.length) {
    const next = vehicles[index];
    const hours = user.vc_seconds / 3600;
    if (hours >= next.vcHours && user.messages >= next.messages) {
      index++;
      unlocked.push(next);
    } else break;
  }

  if (!unlocked.length) return;

  setVehicleIndex(userId, guild.id, index);

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    const last = unlocked[unlocked.length - 1];
    const channel = guild.systemChannel;
    if (channel) {
      await channel.send(
        `🎉 **NEW VEHICLE UNLOCKED!**\n` +
        `${member} has unlocked **${last.emoji} ${last.name}**!\n` +
        `🏁 Collection: **${index}/${vehicles.length}**`
      ).catch(() => {});
    }
  }
}

async function refreshTopGarages(guild, channel) {
  const rows = topUsers(guild.id, 10);
  await channel.send({ embeds: [topGaragesEmbed(rows, guild)] });
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await deployCommands();
    console.log("Vehicle Life is online.");
  } catch (err) {
    console.error("Slash-command registration failed:", err);
  }
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  addMessage(message.author.id, message.guild.id, 1);
  await checkUnlocks(message.guild, message.author.id);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!newState.guild) return;
  const userId = newState.id;
  const guildId = newState.guild.id;

  const joined = !oldState.channelId && newState.channelId;
  const left = oldState.channelId && !newState.channelId;

  // Ignore bots.
  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;

  if (joined) {
    setVcJoin(userId, guildId, Date.now());
  } else if (left) {
    const user = getUser(userId, guildId);
    if (user.last_vc_join) {
      addVcSeconds(userId, guildId, Math.floor((Date.now() - user.last_vc_join) / 1000));
    }
    clearVcJoin(userId, guildId);
    await checkUnlocks(newState.guild, userId);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.guild) return;

  if (interaction.isButton() && interaction.customId.startsWith("garage:")) {
    const [, direction, ownerId, pageText] = interaction.customId.split(":");
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "❌ Only the person who opened this garage can use these buttons.", ephemeral: true });
    }

    const currentPage = Number(pageText) || 0;
    const nextPage = direction === "next" ? currentPage + 1 : currentPage - 1;
    const freshUser = getUser(interaction.user.id, interaction.guild.id);
    const page = garagePage(interaction.member, freshUser, nextPage);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`garage:prev:${ownerId}:${page.page}`)
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page.page <= 0),
      new ButtonBuilder()
        .setCustomId(`garage:next:${ownerId}:${page.page}`)
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page.page >= page.pageCount - 1)
    );

    return interaction.update({ embeds: page.embeds, files: page.files, components: [row] });
  }

  if (!interaction.isChatInputCommand()) return;

  const user = getUser(interaction.user.id, interaction.guild.id);

  if (interaction.commandName === "profile") {
    return interaction.reply({
      embeds: [profileEmbed(interaction.member, user)],
      files: profileFiles(user)
    });
  }

  if (interaction.commandName === "garage") {
    const page = garagePage(interaction.member, user, 0);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`garage:prev:${interaction.user.id}:0`)
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page.page <= 0),
      new ButtonBuilder()
        .setCustomId(`garage:next:${interaction.user.id}:0`)
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page.page >= page.pageCount - 1)
    );

    return interaction.reply({
      embeds: page.embeds,
      files: page.files,
      components: [row]
    });
  }

  if (interaction.commandName === "topgarages") {
    return interaction.reply({ embeds: [topGaragesEmbed(topUsers(interaction.guild.id, 10), interaction.guild)] });
  }

  if (interaction.commandName === "setup") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "❌ You need Manage Server permission.", ephemeral: true });
    }
    if (interaction.channel.type !== ChannelType.GuildText) {
      return interaction.reply({ content: "❌ Run this command inside a text channel.", ephemeral: true });
    }
    return interaction.reply({
      content:
        `✅ **Top Garages channel configured!**\n` +
        `Use \`/topgarages\` here to publish the leaderboard.\n\n` +
        `For automatic updates, put this channel ID in \`TOP_GARAGES_CHANNEL_ID\` in your .env.`
    });
  }
});

async function start() {
  try {
    await initDb();
    await client.login(config.token);
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

start();

process.on("unhandledRejection", err => console.error("Unhandled promise rejection:", err));
process.on("uncaughtException", err => console.error("Uncaught exception:", err));

async function shutdown(signal) {
  console.log(`${signal} received. Saving data and shutting down...`);
  try { await closeDb(); } catch (err) { console.error("Database shutdown error:", err.message); }
  try { client.destroy(); } catch {}
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
