require('dotenv').config();

const express    = require('express');
const multer     = require('multer');
const jwt        = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const fs         = require('fs');
const path       = require('path');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/* ── Cloudinary ─────────────────────────────── */
cloudinary.config({
  cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
  api_key    : process.env.CLOUDINARY_API_KEY,
  api_secret : process.env.CLOUDINARY_API_SECRET
});

/* ── Content store ───────────────────────────
   Uses JSONbin.io when JSONBIN_BIN_ID + JSONBIN_API_KEY are set (Vercel).
   Falls back to local data/content.json for local dev.
──────────────────────────────────────────── */
const DATA_DIR     = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const EMPTY        = { text: {}, media: {}, placeholder: {}, updatedAt: null };

async function readContent() {
  const binId = process.env.JSONBIN_BIN_ID;
  const key   = process.env.JSONBIN_API_KEY;
  if (binId && key) {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' }
      });
      if (r.ok) return (await r.json()).record || EMPTY;
    } catch (_) {}
  }
  try {
    if (fs.existsSync(CONTENT_FILE)) return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  } catch (_) {}
  return { ...EMPTY };
}

async function writeContent(data) {
  const binId = process.env.JSONBIN_BIN_ID;
  const key   = process.env.JSONBIN_API_KEY;
  if (binId && key) {
    await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method  : 'PUT',
      headers : { 'X-Master-Key': key, 'Content-Type': 'application/json' },
      body    : JSON.stringify(data)
    });
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2));
}

/* ── Auth middleware ─────────────────────────── */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-me');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* ── Middleware ──────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

/* ══════════════════════════════════════════════
   API ROUTES
══════════════════════════════════════════════ */

/* POST /api/login */
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token = jwt.sign(
    { admin: true },
    process.env.JWT_SECRET || 'fallback-secret-change-me',
    { expiresIn: '7d' }
  );
  res.json({ token });
});

/* GET /api/content */
app.get('/api/content', async (req, res) => {
  res.json(await readContent());
});

/* POST /api/content */
app.post('/api/content', requireAuth, async (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Invalid content' });
  }
  await writeContent({ ...incoming, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

/* POST /api/upload */
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const b64     = req.file.buffer.toString('base64');
  const dataUri = `data:${req.file.mimetype};base64,${b64}`;
  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'showdem', resource_type: 'auto', use_filename: false
    });
    res.json({ url: result.secure_url, type: result.resource_type });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

/* GET /api/backup */
app.get('/api/backup', requireAuth, async (req, res) => {
  const data = await readContent();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="showdem-backup-${date}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

/* POST /api/restore */
app.post('/api/restore', requireAuth, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid backup' });
  await writeContent(data);
  res.json({ ok: true });
});

/* ── Applications ────────────────────────────── */
const appsHandler = require('./api/applications');
app.get('/api/applications',   (req, res) => appsHandler(req, res));
app.post('/api/applications',  (req, res) => appsHandler(req, res));
app.patch('/api/applications', (req, res) => appsHandler(req, res));
app.delete('/api/applications',(req, res) => appsHandler(req, res));

/* GET /admin */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

/* ── Start (ignored by Vercel, used locally) ── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Showdem server running on port ${PORT}`));

module.exports = app;
