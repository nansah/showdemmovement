const { readApps } = require('./_utils');

const STATE_ABBR = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]);

const STATE_NAME_TO_ABBR = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',
  colorado:'CO',connecticut:'CT',delaware:'DE',florida:'FL',georgia:'GA',
  hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',
  kentucky:'KY',louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',
  michigan:'MI',minnesota:'MN',mississippi:'MS',missouri:'MO',montana:'MT',
  nebraska:'NE',nevada:'NV','new hampshire':'NH','new jersey':'NJ',
  'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',
  ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI',
  'south carolina':'SC','south dakota':'SD',tennessee:'TN',texas:'TX',
  utah:'UT',vermont:'VT',virginia:'VA',washington:'WA','west virginia':'WV',
  wisconsin:'WI',wyoming:'WY','district of columbia':'DC'
};

/* Best-effort extraction of a state from a freeform home-address string,
   used as a fallback for applications submitted before the dedicated
   State field existed. Returns a 2-letter abbreviation or null. */
function extractStateFromAddress(address) {
  if (!address) return null;
  const abbrMatches = address.toUpperCase().match(/\b[A-Z]{2}\b/g) || [];
  for (let i = abbrMatches.length - 1; i >= 0; i--) {
    if (STATE_ABBR.has(abbrMatches[i])) return abbrMatches[i];
  }
  const lower = address.toLowerCase();
  for (const name of Object.keys(STATE_NAME_TO_ABBR)) {
    if (lower.includes(name)) return STATE_NAME_TO_ABBR[name];
  }
  return null;
}

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
   Only ever returns first name + (when derivable) a 2-letter state —
   never the full home address or any other application data — and
   skips anyone under 18. State comes from the dedicated field when
   present, otherwise a best-effort parse of the home address. */
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
    if (!firstName) continue;
    let state = (d.state || '').trim().toUpperCase().slice(0, 2);
    if (!STATE_ABBR.has(state)) state = extractStateFromAddress(d.address);
    recentMembers.push({ firstName, state: state || null, submittedAt: a.submittedAt });
    if (recentMembers.length >= 15) break;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = apps.filter(a => new Date(a.submittedAt) >= monthStart).length;

  res.json({ recentMembers, totalMembers: apps.length, monthCount });
};
