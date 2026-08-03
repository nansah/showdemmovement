const { parseBody, createSignedUpload } = require('./_utils');

// Public counterpart to /api/upload — membership applicants aren't logged
// into the admin panel, so this can't require admin auth. Scoped to image
// files only to limit what an unauthenticated caller can do with it.
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const body     = await parseBody(req);
  const filename = (body && body.filename) || 'photo.jpg';
  const ext      = (filename.split('.').pop() || '').toLowerCase();

  if (!ALLOWED_EXT.includes(ext)) {
    return res.status(400).json({ error: 'Only image files are allowed (jpg, png, webp, heic)' });
  }

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
