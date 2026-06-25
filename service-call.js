// api/adm/service-call.js  -> served at POST /api/adm/service-call on Vercel
// Credentials come from Vercel Environment Variables — never hardcode.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ ok:false, error:'Method not allowed' });

  const SID   = process.env.TWILIO_ACCOUNT_SID;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM  = process.env.TWILIO_FROM_NUMBER;
  if (!SID || !TOKEN || !FROM) {
    return res.status(500).json({ ok:false, error:'Twilio env vars not configured on Vercel' });
  }

  // Vercel parses JSON bodies automatically when Content-Type is application/json
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const { toPhone, userName } = body;

  if (!toPhone || !/^\+\d{7,16}$/.test(toPhone)) {
    return res.status(400).json({ ok:false, error:'Missing or invalid toPhone (E.164, e.g. +2348109893166)' });
  }

  const safeName = String(userName || 'customer').replace(/[^a-zA-Z0-9 ,.'-]/g, '').slice(0, 60);
  const twiml =
    `<Response><Say voice="Polly.Joanna">Hello ${safeName}. This is Bank 36 customer service. ` +
    `We are calling to verify recent activity on your account. ` +
    `Please log in to the Bank 36 app to review the details. Thank you.</Say></Response>`;

  const params = new URLSearchParams({ To: toPhone, From: FROM, Twiml: twiml });

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return res.status(r.status).json({ ok:false, error: data.message || `Twilio error ${r.status}`, code: data.code });
  }
  return res.status(200).json({ ok:true, callSid: data.sid, status: data.status });
}

function safeJson(s){ try { return JSON.parse(s); } catch { return {}; } }
