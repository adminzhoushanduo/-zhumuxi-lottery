const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_KEY = 'lottery_data';
const DATA_FILE_PATH = '/tmp/data.json';
const SEED_PATH = path.join(process.cwd(), 'data', 'data.json');

// Use Node.js built-in https module (always available, no fetch dependency)
function getKvApiUrl() { return process.env.KV_REST_API_URL; }
function getKvApiToken() { return process.env.KV_REST_API_TOKEN; }

function httpsRequest(url, token, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      method: method || 'GET',
      headers: { Authorization: 'Bearer ' + token }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function kvGet(key) {
  if (!getKvApiUrl()) throw new Error('KV not configured');
  const result = await httpsRequest(
    getKvApiUrl() + '/get/' + key,
    getKvApiToken(),
    'GET'
  );
  return result.result ? JSON.parse(result.result) : null;
}

async function kvSet(key, value) {
  if (!getKvApiUrl()) throw new Error('KV not configured');
  const body = JSON.stringify(JSON.stringify(value));
  await httpsRequest(
    getKvApiUrl() + '/set/' + key,
    getKvApiToken(),
    'POST',
    body
  );
}

function parseBody(req) {
  return new Promise(function(resolve) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
  });
}

async function readData() {
  // Try KV first
  try {
    return await kvGet(DATA_KEY);
  } catch (e) {
    // Fallback to /tmp file
    try {
      if (fs.existsSync(DATA_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf-8'));
      }
    } catch (e2) {}
    return null;
  }
}

async function saveData(data) {
  try {
    await kvSet(DATA_KEY, data);
  } catch (e) {
    // Fallback to /tmp file
    try {
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data));
    } catch (e2) {}
  }
}

function defaultData() {
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

module.exports = function(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Wrap everything in async
  (async function() {
    try {
      if (req.method === 'GET') {
        var data = await readData();
        if (!data) {
          // Seed from data.json if available
          try {
            if (fs.existsSync(SEED_PATH)) {
              data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
              await saveData(data);
            }
          } catch (e3) {}
        }
        return res.json(data || defaultData());
      }

      if (req.method === 'POST') {
        var body = await parseBody(req);
        await saveData(body);
        return res.json({ ok: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
      console.error('API Error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  })();
};
