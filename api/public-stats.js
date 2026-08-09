const { readApps } = require('./_utils');

function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob)) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/* Public, unauthenticated feed for the site's FOMO notifications.
   Only ever returns first name + 2-letter state — never full
   applications data — and skips anyone under 18. */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const apps = await readApps();

  const recentMembers = [];
  for (const a of apps) {
    const d = a.data || {};
    const age = calcAge(d.date_of_birth);
    if (age !== null && age < 18) continue;
    const firstName = (d.first_name || '').trim();
    const state = (d.state || '').trim().toUpperCase().slice(0, 2);
    if (!firstName || !state) continue;
    recentMembers.push({ firstName, state, submittedAt: a.submittedAt });
    if (recentMembers.length >= 15) break;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = apps.filter(a => new Date(a.submittedAt) >= monthStart).length;

  res.json({ recentMembers, totalMembers: apps.length, monthCount });
};
