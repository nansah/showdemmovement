const { requireAuth, parseBody, readContent, writeContent } = require('./_utils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.json(await readContent());
  }

  if (req.method === 'POST') {
    if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    const body = await parseBody(req);
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid content' });
    try {
      await writeContent({ ...body, updatedAt: new Date().toISOString() });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
};
