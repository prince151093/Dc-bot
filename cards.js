const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { vehicles } = require("./vehicles");

function hours(seconds) {
  return (seconds / 3600).toFixed(1);
}

function progressBar(current, required, size = 14) {
  if (!required) return "██████████████";
  const ratio = Math.max(0, Math.min(1, current / required));
  const filled = Math.round(ratio * size);
  return "█".repeat(filled) + "░".repeat(size - filled);
}

function currentVehicle(user) {
  return user.vehicle_index > 0 ? vehicles[user.vehicle_index - 1] : null;
}

function nextVehicle(user) {
  return user.vehicle_index < vehicles.length ? vehicles[user.vehicle_index] : null;
}

function profileEmbed(member, user) {
  const current = currentVehicle(user);
  const next = nextVehicle(user);

  const embed = new EmbedBuilder()
    .setTitle(`🚗 ${member.displayName}'s Vehicle Life`)
    .setDescription(current
      ? `### ${current.emoji} ${current.name}\nYour current ride`
      : "### 🚶 No Vehicle\nStart your journey by being active in the server.")
    .addFields(
      { name: "🎙️ VC Time", value: `${hours(user.vc_seconds)} hours`, inline: true },
      { name: "💬 Messages", value: user.messages.toLocaleString(), inline: true },
      { name: "🚗 Vehicles", value: `${user.vehicle_index} / ${vehicles.length}`, inline: true }
    )
    .setColor(0x168cff)
    .setFooter({ text: "Vehicle Life • Be active. Build your garage." });

  if (next) {
    const vc = user.vc_seconds / 3600;
    const vcPct = Math.min(100, Math.floor((vc / next.vcHours) * 100));
    const msgPct = Math.min(100, Math.floor((user.messages / next.messages) * 100));
    embed.addFields({
      name: `🔒 Next: ${next.emoji} ${next.name}`,
      value:
        `🎙️ ${next.vcHours}h VC • ${vcPct}%\n` +
        `💬 ${next.messages.toLocaleString()} messages • ${msgPct}%\n` +
        `\`${progressBar(vc, next.vcHours)}\` VC`
    });
  } else {
    embed.addFields({ name: "🏆 Collection Complete", value: "You have unlocked every vehicle!" });
  }

  return embed;
}

function garageEmbed(member, user) {
  const groups = [
    ["🏍️ BIKES", "bike"],
    ["🚗 CARS", "car"],
    ["✈️ AIRCRAFT", "aircraft"]
  ];

  const embed = new EmbedBuilder()
    .setTitle(`🏁 ${member.displayName.toUpperCase()}'S GARAGE`)
    .setDescription(`🚗 **${user.vehicle_index} / ${vehicles.length} VEHICLES**`)
    .setColor(0x168cff);

  for (const [title, category] of groups) {
    const list = vehicles.filter(v => v.category === category)
      .map(v => v.id <= user.vehicle_index ? `✅ ${v.name}` : `🔒 ${v.name}`)
      .join("\n");
    embed.addFields({ name: title, value: list || "—", inline: false });
  }

  embed.setFooter({ text: "Vehicle Life • Your collection, your journey." });
  return embed;
}

function topGaragesEmbed(rows, guild) {
  const lines = rows.map((u, i) => {
    const v = currentVehicle(u);
    return `**#${i + 1} • ${v ? `${v.emoji} ${v.name}` : "🚶 No Vehicle"}**\n` +
      `<@${u.user_id}> • **${u.vehicle_index}/${vehicles.length}** vehicles • 🎙️ ${hours(u.vc_seconds)}h • 💬 ${u.messages.toLocaleString()}`;
  });

  return new EmbedBuilder()
    .setTitle("🏆 TOP GARAGES")
    .setDescription(lines.join("\n\n") || "No players yet.")
    .setColor(0x168cff)
    .setFooter({ text: `${guild.name} • Vehicle Life` })
    .setTimestamp();
}

module.exports = { profileEmbed, garageEmbed, topGaragesEmbed, currentVehicle, nextVehicle };