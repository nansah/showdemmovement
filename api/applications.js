const { requireAuth, parseBody, readApps, writeApp, updateApp, deleteApp } = require('./_utils');

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* GET — list all (admin only) */
  if (req.method === 'GET') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await readApps());
  }

  /* POST — submit new application (public) */
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.first_name) return res.status(400).json({ error: 'Invalid submission' });
    if (!body.photo_url) return res.status(400).json({ error: 'A photo is required' });
    const app = { id: genId(), submittedAt: new Date().toISOString(), status: 'pending', notes: '', data: body };
    await writeApp(app);
    return res.json({ ok: true, id: app.id });
  }

  /* PATCH — update status or notes (admin only) */
  if (req.method === 'PATCH') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { id, status, notes } = await parseBody(req);
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (notes  !== undefined) updates.notes  = notes;
    await updateApp(id, updates);
    return res.json({ ok: true });
  }

  /* DELETE — remove application (admin only) */
  if (req.method === 'DELETE') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = await parseBody(req);
    if (!id) return res.status(400).json({ error: 'Missing id' });
    await deleteApp(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
};
