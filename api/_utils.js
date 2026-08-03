/**
 * Shared utilities for all api/ serverless functions.
 * Falls back to local JSON files when SUPABASE_URL is not set (local dev without Supabase).
 */
const jwt  = require('jsonwebtoken');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const APPS_FILE    = path.join(DATA_DIR, 'applications.json');
const WAIVERS_FILE = path.join(DATA_DIR, 'waivers.json');
const EMPTY_CONTENT = { text: {}, media: {}, placeholder: {}, updatedAt: null };

function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/* ── Auth ─────────────────────────────────── */
function requireAuth(req) {
  const header = (req.headers['authorization'] || '');
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  try { jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-me'); return true; }
  catch (_) { return false; }
}

/* ── Body parsing ─────────────────────────── */
function parseBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
      resolve(req.body); return;
    }
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ── Content (timeline card data) ─────────── */
async function readContent() {
  if (hasSupabase()) {
    const db = getSupabase();
    const { data } = await db.from('content').select('data').eq('id', 1).single();
    return data?.data || { ...EMPTY_CONTENT };
  }
  try {
    if (fs.existsSync(CONTENT_FILE)) return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  } catch (_) {}
  return { ...EMPTY_CONTENT };
}

async function writeContent(content) {
  if (hasSupabase()) {
    const db = getSupabase();
    await db.from('content').upsert({ id: 1, data: content, updated_at: new Date().toISOString() });
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
}

/* ── Applications ─────────────────────────── */
async function readApps() {
  if (hasSupabase()) {
    const db = getSupabase();
    const { data } = await db
      .from('applications').select('*')
      .order('submitted_at', { ascending: false });
    return (data || []).map(r => ({
      id: r.id, submittedAt: r.submitted_at, status: r.status,
      notes: r.notes, data: r.data, updatedAt: r.updated_at
    }));
  }
  try {
    if (fs.existsSync(APPS_FILE)) return JSON.parse(fs.readFileSync(APPS_FILE, 'utf8'));
  } catch (_) {}
  return [];
}

async function writeApp(app) {
  if (hasSupabase()) {
    const db = getSupabase();
    await db.from('applications').insert({
      id: app.id, submitted_at: app.submittedAt,
      status: app.status, notes: app.notes, data: app.data
    });
    return;
  }
  const apps = await readApps();
  apps.unshift(app);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
}

async function updateApp(id, updates) {
  if (hasSupabase()) {
    const db = getSupabase();
    await db.from('applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    return;
  }
  const apps = fs.existsSync(APPS_FILE) ? JSON.parse(fs.readFileSync(APPS_FILE, 'utf8')) : [];
  const idx  = apps.findIndex(a => a.id === id);
  if (idx !== -1) {
    Object.assign(apps[idx], updates, { updatedAt: new Date().toISOString() });
    fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
  }
}

async function deleteApp(id) {
  if (hasSupabase()) {
    const db = getSupabase();
    await db.from('applications').delete().eq('id', id);
    return;
  }
  const apps = fs.existsSync(APPS_FILE) ? JSON.parse(fs.readFileSync(APPS_FILE, 'utf8')) : [];
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps.filter(a => a.id !== id), null, 2));
}

/* ── Waivers ──────────────────────────────── */
async function readWaivers() {
  if (hasSupabase()) {
    const db = getSupabase();
    const { data } = await db
      .from('waivers').select('*')
      .order('submitted_at', { ascending: false });
    return (data || []).map(r => ({ id: r.id, submittedAt: r.submitted_at, data: r.data }));
  }
  try {
    if (fs.existsSync(WAIVERS_FILE)) return JSON.parse(fs.readFileSync(WAIVERS_FILE, 'utf8'));
  } catch (_) {}
  return [];
}

async function writeWaiver(waiver) {
  if (hasSupabase()) {
    const db = getSupabase();
    await db.from('waivers').insert({
      id: waiver.id, submitted_at: waiver.submittedAt, data: waiver.data
    });
    return;
  }
  const waivers = await readWaivers();
  waivers.unshift(waiver);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WAIVERS_FILE, JSON.stringify(waivers, null, 2));
}

/* ── File upload ──────────────────────────── */
// Vercel serverless functions cap request bodies at a few MB, so large media
// (especially phone videos) can't be uploaded through our own API. Instead we
// hand the browser a signed Supabase Storage URL and let it PUT the file
// straight to Supabase, bypassing our function's body limit entirely.
async function createSignedUpload(originalname) {
  if (!hasSupabase()) throw new Error('Supabase not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const db  = getSupabase();
  const ext = (originalname.split('.').pop() || 'bin').toLowerCase();
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await db.storage.from('media').createSignedUploadUrl(key);
  if (error) throw new Error(error.message);
  const { data: pub } = db.storage.from('media').getPublicUrl(key);
  return { signedUrl: data.signedUrl, token: data.token, path: data.path, publicUrl: pub.publicUrl };
}

module.exports = {
  requireAuth, parseBody,
  readContent, writeContent,
  readApps, writeApp, updateApp, deleteApp,
  readWaivers, writeWaiver,
  createSignedUpload
};
