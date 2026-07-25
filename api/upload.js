const multer                 = require('multer');
const { requireAuth, uploadFile } = require('./_utils');

const parse = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 50 * 1024 * 1024 }
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();
  if (!requireAuth(req))       return res.status(401).json({ error: 'Unauthorized' });

  await new Promise((ok, fail) => parse.single('file')(req, res, e => e ? fail(e) : ok()));

  if (!req.file) return res.status(400).json({ error: 'No file received' });

  try {
    const result = await uploadFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
