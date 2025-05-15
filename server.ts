import express from 'express';
import { client } from './index';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  const data = req.body;

  console.log('📥 Neue Shoppy-Bestellung:', data);

  const discordTag: string | undefined = data.custom_fields?.discord;
  if (!discordTag || !discordTag.includes('#')) return res.sendStatus(400);

  const [username, discriminator] = discordTag.split('#');

  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  const members = await guild.members.fetch();

  const member = members.find(
    (m) => m.user.username === username && m.user.discriminator === discriminator
  );

  if (member) {
    await member.roles.add(process.env.DISCORD_ROLE_ID!);
    console.log(`✅ Rolle zugewiesen an ${member.user.tag}`);
    return res.sendStatus(200);
  } else {
    console.warn(`❌ Mitglied ${discordTag} nicht gefunden.`);
    return res.sendStatus(404);
  }
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Webhook-Server läuft auf Port ${process.env.PORT}`);
});
