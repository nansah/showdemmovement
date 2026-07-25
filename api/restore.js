const { requireAuth, parseBody, writeContent } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).end();
  if (!requireAuth(req))        return res.status(401).json({ error: 'Unauthorized' });

  const data = await parseBody(req);
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid backup' });
  await writeContent(data);
  res.json({ ok: true });
};
