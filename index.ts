import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
dotenv.config();

export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', () => {
  console.log(`✅ Bot online als ${client.user?.tag}`);
  processExpiredRoles();
  setInterval(processExpiredRoles, 60 * 1000);
});

const app = express();
app.use(express.json());

const dbPromise = open({
  filename: path.join(__dirname, 'database', 'roleData.db'),
  driver: sqlite3.Database,
});

const productConfigPath = path.join(__dirname, 'productConfig.json');

// Helper to load product configuration
function loadProductConfig() {
  if (!fs.existsSync(productConfigPath)) {
    console.error('Product configuration file not found:', productConfigPath);
    return {};
  }
  return JSON.parse(fs.readFileSync(productConfigPath, 'utf-8'));
}

async function initializeDatabase() {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS role_expirations (
      discord_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      expiration INTEGER NOT NULL,
      PRIMARY KEY (discord_id, role_id)
    )
  `);
}
initializeDatabase();

async function processExpiredRoles() {
  const db = await dbPromise;
  const now = Date.now();

  const expiredRoles = await db.all(
    'SELECT discord_id, role_id FROM role_expirations WHERE expiration <= ?',
    now
  );

  for (const { discord_id, role_id } of expiredRoles) {
    try {
      const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
      const member = await guild.members.fetch(discord_id).catch(() => null);
      if (member) {
        await member.roles.remove(role_id);
        console.log(`Removed expired role ${role_id} from user ${discord_id}`);
      }
    } catch (err) {
      console.error(`Error removing role ${role_id} from user ${discord_id}:`, err);
    }
    await db.run('DELETE FROM role_expirations WHERE discord_id = ? AND role_id = ?', discord_id, role_id);
  }
}

app.post('/shoppy-webhook', async (req, res) => {
  try {
    console.log('Received webhook payload:', req.body);

    const productId = req.body?.data?.product?.id;
    let discordId = req.body?.customer?.discord_id || req.body?.discord_id;

    if (!productId) {
      console.error('Missing product ID in payload:', req.body);
      return res.status(400).json({ error: 'No product ID in webhook payload' });
    }

    if (!discordId) {
      console.warn('Missing discord_id in payload. Using fallback for testing.');
      discordId = process.env.TEST_DISCORD_ID;
    }

    const productConfig = loadProductConfig();
    const durationDays = productConfig[productId];

    if (durationDays === undefined) {
      console.error(`Unknown product ID: ${productId}`);
      return res.status(400).json({ error: 'Unknown product ID' });
    }

    const duration = durationDays ? durationDays * 24 * 60 * 60 * 1000 : null; // Convert days to milliseconds

    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      console.error('Discord user not found in guild:', discordId);
      return res.status(404).json({ error: 'Discord user not found in guild' });
    }

    await member.roles.add(process.env.DISCORD_ROLE_ID!);
    console.log(`Role added to user: ${discordId}`);

    if (duration) {
      const db = await dbPromise;
      const expiration = Date.now() + duration;
      await db.run(
        'INSERT OR REPLACE INTO role_expirations (discord_id, role_id, expiration) VALUES (?, ?, ?)',
        discordId,
        process.env.DISCORD_ROLE_ID!,
        expiration
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server listening on port ${PORT}`);
});

await client.login(process.env.DISCORD_TOKEN);
