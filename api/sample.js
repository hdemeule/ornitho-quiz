// Claude dans l'app (lecture de photos, génération en JSON). Toujours Claude, servi par Anthropic.
import { send, body, hasSession, ready } from './_lib.js';

const pick = m => (m && m.startsWith('anthropic/claude-')) ? m : null;
const MODEL = { default: pick(process.env.AI_MODEL_DEFAULT) || 'anthropic/claude-sonnet-5.5', complex: pick(process.env.AI_MODEL_COMPLEX) || 'anthropic/claude-sonnet-5.5' };
const SYSTEM = `Tu travailles pour Hugues, en Belgique. Réponds en français clair, sans tiret long. N'invente jamais de fait, de chiffre ni de source : en cas de doute, dis-le.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { code: 'bad_request' });
  try { await ready(); } catch { return send(res, 503, { code: 'unavailable' }); }
  if (!(await hasSession(req))) return send(res, 401, { code: 'not_granted', error: "Cet appareil n'est pas connecté." });
  const token = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return send(res, 503, { code: 'unavailable', error: "L'accès à Claude n'est pas configuré." });
  const b = body(req);
  const images = (Array.isArray(b.images) ? b.images : []).filter(u => /^data:image\/(jpeg|png|webp|gif);base64,/.test(u)).slice(0, 6);
  const wantJson = b.format !== 'text';
  const content = [...images.map(url => ({ type: 'image_url', image_url: { url } })), { type: 'text', text: String(b.prompt || '').slice(0, 60000) + (wantJson ? '\n\nRéponds uniquement avec un objet JSON valide, sans texte autour.' : '') }];
  let r;
  try {
    r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL[b.tier] || MODEL.default, providerOptions: { gateway: { only: ['anthropic'] } }, max_tokens: 8000, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }] })
    });
  } catch { return send(res, 502, { code: 'unavailable' }); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = JSON.stringify(data).toLowerCase();
    console.error('gateway', r.status, m.slice(0, 300));
    if (r.status === 402 || m.includes('credit') || m.includes('budget')) return send(res, 402, { code: 'quota_exceeded', error: 'Crédit Claude épuisé ou plafond atteint.' });
    if (r.status === 429) return send(res, 429, { code: 'rate_limited' });
    return send(res, 502, { code: 'unavailable' });
  }
  const text = data.choices?.[0]?.message?.content || '';
  if (!wantJson) return send(res, 200, { text });
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  try { return send(res, 200, { json: JSON.parse(text.slice(s, e + 1)) }); }
  catch { return send(res, 502, { code: 'bad_shape' }); }
}
