import { put, get } from '@vercel/blob';

const ok = k => /^[a-f0-9]{64}$/.test(k);

async function readBlob(path) {
  for (const access of ['private', 'public']) {
    try {
      const r = await get(path, { access, useCache: false });
      if (!r) return null;
      if (r.statusCode === 200) return await new Response(r.stream).text();
      return null;
    } catch (e) {
      if (e && e.name === 'BlobNotFoundError') return null;
      if (access === 'public') throw e;
    }
  }
  return null;
}
async function writeBlob(path, body) {
  const opts = { addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 };
  try { await put(path, body, { ...opts, access: 'private' }); }
  catch (e) { await put(path, body, { ...opts, access: 'public' }); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'stockage non configuré' });
  const k = String((req.query && req.query.k) || '');
  if (!ok(k)) return res.status(400).json({ error: 'clé invalide' });
  const path = `progress/${k}.json`;
  try {
    if (req.method === 'GET') {
      const txt = await readBlob(path);
      if (!txt) return res.status(404).json({ error: 'aucune progression' });
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(txt);
    }
    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (body.length > 3000000) return res.status(413).json({ error: 'trop gros' });
      JSON.parse(body);
      await writeBlob(path, body);
      return res.status(200).json({ ok: true, at: Date.now() });
    }
    return res.status(405).json({ error: 'méthode non permise' });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
}
