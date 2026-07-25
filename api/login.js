const jwt           = require('jsonwebtoken');
const { parseBody } = require('./_utils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { password } = await parseBody(req);
  if (!password || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Incorrect password' });

  const secret = process.env.JWT_SECRET || 'fallback-secret-change-me';
  const token  = jwt.sign({ admin: true }, secret, { expiresIn: '7d' });
  res.json({ token });
};
