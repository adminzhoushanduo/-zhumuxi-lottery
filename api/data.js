const { kv } = require('@vercel/kv');

const DATA_KEY = 'lottery_data';
const DATA_FILE_PATH = '/tmp/data.json';
const SEED_PATH = require('path').join(__dirname, '..', 'data', 'data.json');

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

async function readFromKV() {
  try {
    if (!kv || !process.env.KV_REST_API_URL) throw new Error('KV not available');
    return await kv.get(DATA_KEY);
  } catch {
    const fs = require('fs');
    if (fs.existsSync(DATA_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf-8'));
    }
    return null;
  }
}

async function saveToKV(data) {
  try {
    if (!kv || !process.env.KV_REST_API_URL) throw new Error('KV not available');
    await kv.set(DATA_KEY, data);
  } catch {
    const fs = require('fs');
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data));
  }
}

function getDefaultData() {
  return {
    lastDrawDate: '',
    extraChances: 0,
    ownedGifts: [],
    history: [],
    diamond: 0,
    shardCount: 0,
    pityCount: 0,
    tasks: [],
    firstVisit: true,
    lastResetDate: ''
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      let data = await readFromKV();

      if (!data) {
        const fs = require('fs');
        if (fs.existsSync(SEED_PATH)) {
          try {
            data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
            await saveToKV(data);
          } catch {}
        }
      }

      return res.json(data || getDefaultData());
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      await saveToKV(body);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('API Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
