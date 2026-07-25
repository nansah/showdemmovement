const jwt = require('jsonwebtoken');

const APPS_BIN = process.env.JSONBIN_APPS_BIN_ID;
const API_KEY  = process.env.JSONBIN_API_KEY;

async function readApps() {
  if (APPS_BIN && API_KEY) {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${APPS_BIN}/latest`, {
        headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
      });
      if (r.ok) return (await r.json()).record || { applications: [] };
    } catch (_) {}
  }
  try {
    const fs = require('fs'), path = require('path');
    const f = path.join(__dirname, '..', 'data', 'applications.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) {}
  return { applications: [] };
}

async function writeApps(store) {
  if (APPS_BIN && API_KEY) {
    await fetch(`https://api.jsonbin.io/v3/b/${APPS_BIN}`, {
      method: 'PUT',
      headers: { 'X-Master-Key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(store)
    });
    return;
  }
  const fs = require('fs'), path = require('path');
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'applications.json'), JSON.stringify(store, null, 2));
}

function requireAuth(req) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  try { jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-me'); return true; }
  catch (_) { return false; }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) { resolve(req.body); return; }
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* GET — list all applications (admin only) */
  if (req.method === 'GET') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const store = await readApps();
    return res.json(store.applications || []);
  }

  /* POST — submit new application (public) */
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.first_name) return res.status(400).json({ error: 'Invalid submission' });
    const app = {
      id:          genId(),
      submittedAt: new Date().toISOString(),
      status:      'pending',
      notes:       '',
      data:        body
    };
    const store = await readApps();
    store.applications = [app, ...(store.applications || [])];
    await writeApps(store);
    return res.json({ ok: true, id: app.id });
  }

  /* PATCH — update status / notes (admin only) */
  if (req.method === 'PATCH') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = await parseBody(req);
    const { id, status, notes } = body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const store  = await readApps();
    const idx    = (store.applications || []).findIndex(a => a.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (status !== undefined) store.applications[idx].status = status;
    if (notes  !== undefined) store.applications[idx].notes  = notes;
    store.applications[idx].updatedAt = new Date().toISOString();
    await writeApps(store);
    return res.json({ ok: true });
  }

  /* DELETE — remove application (admin only) */
  if (req.method === 'DELETE') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = await parseBody(req);
    const { id } = body || {};
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const store = await readApps();
    store.applications = (store.applications || []).filter(a => a.id !== id);
    await writeApps(store);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
