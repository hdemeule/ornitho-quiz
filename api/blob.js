// Photos de l'app : envoi (POST) et affichage (GET, servi aussi sous /_blob/<id>).
import { APP, sql, ready, send, hasSession, rand } from './_lib.js';
import { randomBytes } from 'node:crypto';

export const config = { api: { bodyParser: false } };

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try { await ready(); } catch { return send(res, 503, { error: 'Base indisponible.' }); }
  if (!(await hasSession(req))) return send(res, 401, { error: 'locked' });
  const q = sql();
  if (req.method === 'GET') {
    const id = String(req.query?.id || '');
    const r = await q`SELECT mime, data FROM blobs WHERE app = ${APP} AND id = ${id}`;
    if (!r.length) return send(res, 404, { error: 'Photo introuvable.' });
    res.setHeader('content-type', r[0].mime);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    return res.status(200).send(Buffer.from(r[0].data));
  }
  if (req.method === 'POST') {
    const mime = String(req.headers['x-mime'] || 'image/jpeg');
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return send(res, 415, { error: 'Format non pris en charge.' });
    const buf = await readBody(req);
    if (!buf.length || buf.length > 8 * 1024 * 1024) return send(res, 413, { error: 'Photo trop grosse.' });
    const wanted = String(req.query?.id || '');
    const id = /^[0-9a-f]{32}$/.test(wanted) ? wanted : randomBytes(16).toString('hex');
    await q`INSERT INTO blobs (app, id, mime, data) VALUES (${APP}, ${id}, ${mime}, ${buf}) ON CONFLICT (app, id) DO NOTHING`;
    return send(res, 200, { id, url: '/_blob/' + id });
  }
  return send(res, 405, { error: 'Méthode non permise.' });
}
