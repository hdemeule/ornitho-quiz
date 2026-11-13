// Données de l'app : documents rangés par chemin « collection/id », synchronisés entre appareils.
import { APP, sql, ready, send, body, hasSession } from './_lib.js';

const PATH = /^[^/\s]{1,80}\/[^/]{1,200}$/;

export default async function handler(req, res) {
  try { await ready(); } catch { return send(res, 503, { error: 'Base indisponible.' }); }
  if (!(await hasSession(req))) return send(res, 401, { error: 'locked' });
  const q = sql();
  if (req.method === 'GET') {
    const since = Number(req.query?.since || 0) || 0;
    const now = Date.now();
    const rows = await q`SELECT path, data, deleted, updated_at FROM docs WHERE app = ${APP} AND updated_at > ${since} ORDER BY updated_at`;
    return send(res, 200, { now, items: rows.map(r => ({ path: r.path, data: r.data, deleted: r.deleted, updatedAt: Number(r.updated_at) })) });
  }
  if (req.method === 'POST') {
    const ops = (body(req).ops || []).slice(0, 500);
    let n = 0;
    for (const o of ops) {
      if (!PATH.test(String(o.path || ''))) continue;
      const ts = Date.now() + (n++ / 1000);
      if (o.op === 'delete') {
        await q`INSERT INTO docs (app, path, data, deleted, updated_at) VALUES (${APP}, ${o.path}, null, true, ${ts})
                ON CONFLICT (app, path) DO UPDATE SET data = null, deleted = true, updated_at = EXCLUDED.updated_at`;
      } else {
        const v = JSON.stringify(o.data ?? {});
        if (v.length > 900000) return send(res, 413, { error: 'Document trop gros.' });
        await q`INSERT INTO docs (app, path, data, deleted, updated_at) VALUES (${APP}, ${o.path}, ${v}::jsonb, false, ${ts})
                ON CONFLICT (app, path) DO UPDATE SET data = EXCLUDED.data, deleted = false, updated_at = EXCLUDED.updated_at`;
      }
    }
    return send(res, 200, { ok: true, applied: n });
  }
  return send(res, 405, { error: 'Méthode non permise.' });
}
