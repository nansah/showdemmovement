const { requireAuth, parseBody, createSignedUpload } = require('./_utils');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();
  if (!requireAuth(req))       return res.status(401).json({ error: 'Unauthorized' });

  const body     = await parseBody(req);
  const filename = (body && body.filename) || 'upload.bin';

  try {
    const { signedUrl, token, path, publicUrl } = await createSignedUpload(filename);
    res.json({
      signedUrl, token, path,
      url:             publicUrl,
      supabaseUrl:     process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
