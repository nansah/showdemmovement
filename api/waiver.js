const { requireAuth, parseBody, readWaivers, writeWaiver } = require('./_utils');

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* GET — list all (admin only) */
  if (req.method === 'GET') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    return res.json(await readWaivers());
  }

  /* POST — submit new waiver (public) */
  if (req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.fullName || !body.signature) {
      return res.status(400).json({ error: 'Invalid submission' });
    }
    const waiver = { id: genId(), submittedAt: new Date().toISOString(), data: body };
    try {
      await writeWaiver(waiver);
      return res.json({ ok: true, id: waiver.id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
};
