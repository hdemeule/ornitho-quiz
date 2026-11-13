// Socle commun : base Neon, sessions, cookies. Les fichiers commençant par « _ » ne sont pas des routes Vercel.
import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const APP = process.env.APP_ID || 'time';
export const RP_NAME = process.env.APP_NAME || 'App';
const COOKIE = 'hsess_' + APP;
const SESSION_DAYS = 180;

let _sql = null, _ready = null;
export function sql() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('no-db'), { code: 'no-db' });
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}
// Tables communes à toutes les apps de Hugues (colonne app pour les séparer)
export async function ready() {
  if (!_ready) _ready = (async () => {
    const q = sql();
    await q`CREATE TABLE IF NOT EXISTS passkeys (app text NOT NULL, id text NOT NULL, public_key text NOT NULL, counter bigint NOT NULL DEFAULT 0, transports text, device text, created_at timestamptz NOT NULL DEFAULT now(), last_used timestamptz, PRIMARY KEY (app, id))`;
    await q`CREATE TABLE IF NOT EXISTS sessions (app text NOT NULL, token_hash text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, device text)`;
    await q`CREATE TABLE IF NOT EXISTS challenges (id text PRIMARY KEY, app text NOT NULL, challenge text NOT NULL, kind text NOT NULL, expires_at timestamptz NOT NULL)`;
    await q`CREATE TABLE IF NOT EXISTS kv (app text NOT NULL, key text NOT NULL, value jsonb, updated_at bigint NOT NULL, PRIMARY KEY (app, key))`;
    await q`CREATE TABLE IF NOT EXISTS docs (app text NOT NULL, path text NOT NULL, data jsonb, deleted boolean NOT NULL DEFAULT false, updated_at bigint NOT NULL, PRIMARY KEY (app, path))`;
    await q`CREATE INDEX IF NOT EXISTS docs_since ON docs (app, updated_at)`;
    await q`CREATE TABLE IF NOT EXISTS blobs (app text NOT NULL, id text NOT NULL, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (app, id))`;
  })().catch(e => { _ready = null; throw e; });
  return _ready;
}

export const sha = s => createHash('sha256').update(s).digest('hex');
export const rand = (n = 32) => randomBytes(n).toString('base64url');

export function send(res, status, obj, headers = {}) {
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(status).setHeader('content-type', 'application/json').setHeader('cache-control', 'no-store').send(JSON.stringify(obj));
}
export function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }

export function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
}
export const sessionCookie = token => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function createSession(req) {
  const token = rand(32);
  await sql()`INSERT INTO sessions (app, token_hash, expires_at, device) VALUES (${APP}, ${sha(token)}, now() + make_interval(days => ${SESSION_DAYS}), ${String(req.headers['user-agent'] || '').slice(0, 160)})`;
  return token;
}
export async function hasSession(req) {
  const t = cookies(req)[COOKIE];
  if (!t) return false;
  try {
    await ready();
    const r = await sql()`SELECT 1 FROM sessions WHERE app = ${APP} AND token_hash = ${sha(t)} AND expires_at > now()`;
    return r.length > 0;
  } catch { return false; }
}
export function codeOk(given) {
  const real = process.env.APP_CODE || process.env.TIME_CODE;
  if (!real || !given) return false;
  const a = Buffer.from(sha(String(given))), b = Buffer.from(sha(real));
  return timingSafeEqual(a, b);
}
// Domaine et origine attendus pour les clés d'accès : l'adresse réelle de l'app
export function rp(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return { rpID: host.split(':')[0], origin: `https://${host}` };
}
