const DATA_KEY = 'lottery_data';
const DATA_FILE_PATH = '/tmp/data.json';
const SEED_PATH = require('path').join(__dirname, '..', 'data', 'data.json');

// Use Upstash Redis REST API directly (no @vercel/kv dependency needed)
function kvApiUrl() { return process.env.KV_REST_API_URL; }
function kvApiToken() { return process.env.KV_REST_API_TOKEN; }

async function kvGet(key) {
  if (!kvApiUrl()) throw new Error('KV not configured');
  const resp = await fetch(kvApiUrl() + '/get/' + key, {
    headers: { Authorization: 'Bearer ' + kvApiToken() }
  });
  if (!resp.ok) throw new Error('KV GET failed: ' + resp.status);
  const result = await resp.json();
  return result.result ? JSON.parse(result.result) : null;
}

async function kvSet(key, value) {
  if (!kvApiUrl()) throw new Error('KV not configured');
  const resp = await fetch(kvApiUrl() + '/set/' + key, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + kvApiToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(JSON.stringify(value))
  });
  if (!resp.ok) throw new Error('KV SET failed: ' + resp.status);
}

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
    return await kvGet(DATA_KEY);
  } catch {
    const fs = require('fs');
    if (fs.existsSync(DATA_FILE_PATH)) {
      try { return JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf-8')); }
      catch {}
    }
    return null;
  }
}

async function saveToKV(data) {
  try {
    await kvSet(DATA_KEY, data);
  } catch {
    const fs = require('fs');
    try { fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data)); }
    catch {}
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
