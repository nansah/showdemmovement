const { requireAuth, readContent } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).end();
  if (!requireAuth(req))        return res.status(401).json({ error: 'Unauthorized' });

  const data = await readContent();
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="showdem-backup-${date}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
};
