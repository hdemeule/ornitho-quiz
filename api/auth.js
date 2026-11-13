// Verrou de Time. : clés d'accès (empreinte, Windows Hello) avec le code d'accès en secours.
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { APP, RP_NAME, sql, ready, send, body, createSession, hasSession, codeOk, rp, rand, sessionCookie, clearCookie, cookies, sha } from './_lib.js';

const tries = new Map(); // limite les essais de code par instance
function tooMany(ip) {
  const now = Date.now(), t = (tries.get(ip) || []).filter(x => now - x < 15 * 60e3);
  tries.set(ip, t); return t.length >= 8;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non permise.' });
  const b = body(req);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0];
  try { await ready(); }
  catch { return send(res, 503, { error: "La base de données ne répond pas. Réessaie dans un instant." }); }
  const q = sql();
  const { rpID, origin } = rp(req);

  try {
    switch (b.action) {
      case 'status': {
        const keys = await q`SELECT count(*)::int AS n FROM passkeys WHERE app = ${APP}`;
        return send(res, 200, { unlocked: await hasSession(req), passkeys: keys[0].n });
      }
      case 'code': { // déverrouillage par le code de secours
        if (tooMany(ip)) return send(res, 429, { error: 'Trop d\'essais. Attends un quart d\'heure.' });
        if (!codeOk(b.code)) { tries.get(ip).push(Date.now()); return send(res, 401, { error: 'Code incorrect.' }); }
        const token = await createSession(req);
        return send(res, 200, { ok: true }, { 'set-cookie': sessionCookie(token) });
      }
      case 'reg-options': { // ajout d'une empreinte : seulement une fois déverrouillé
        if (!(await hasSession(req))) return send(res, 401, { error: 'Déverrouille d\'abord avec ton code.' });
        const existing = await q`SELECT id, transports FROM passkeys WHERE app = ${APP}`;
        const opts = await generateRegistrationOptions({
          rpName: RP_NAME, rpID, userName: 'Hugues · ' + RP_NAME, userDisplayName: 'Hugues',
          userID: new TextEncoder().encode('hugues-' + APP), attestationType: 'none',
          excludeCredentials: existing.map(k => ({ id: k.id, transports: k.transports ? k.transports.split(',') : undefined })),
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
        });
        const id = rand(16);
        await q`INSERT INTO challenges (id, app, challenge, kind, expires_at) VALUES (${id}, ${APP}, ${opts.challenge}, 'reg', now() + interval '5 minutes')`;
        return send(res, 200, { id, options: opts });
      }
      case 'reg-verify': {
        if (!(await hasSession(req))) return send(res, 401, { error: 'Session expirée. Déverrouille avec ton code.' });
        const ch = await q`DELETE FROM challenges WHERE id = ${b.id} AND app = ${APP} AND kind = 'reg' AND expires_at > now() RETURNING challenge`;
        if (!ch.length) return send(res, 400, { error: 'Demande expirée. Recommence.' });
        const v = await verifyRegistrationResponse({ response: b.response, expectedChallenge: ch[0].challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
        if (!v.verified) return send(res, 400, { error: "L'empreinte n'a pas pu être enregistrée." });
        const c = v.registrationInfo.credential;
        await q`INSERT INTO passkeys (app, id, public_key, counter, transports, device) VALUES (${APP}, ${c.id}, ${Buffer.from(c.publicKey).toString('base64url')}, ${c.counter}, ${(c.transports || []).join(',')}, ${String(b.device || '').slice(0, 80)}) ON CONFLICT DO NOTHING`;
        return send(res, 200, { ok: true });
      }
      case 'auth-options': {
        const opts = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
        const id = rand(16);
        await q`INSERT INTO challenges (id, app, challenge, kind, expires_at) VALUES (${id}, ${APP}, ${opts.challenge}, 'auth', now() + interval '5 minutes')`;
        return send(res, 200, { id, options: opts });
      }
      case 'auth-verify': {
        const ch = await q`DELETE FROM challenges WHERE id = ${b.id} AND app = ${APP} AND kind = 'auth' AND expires_at > now() RETURNING challenge`;
        if (!ch.length) return send(res, 400, { error: 'Demande expirée. Recommence.' });
        const k = await q`SELECT * FROM passkeys WHERE app = ${APP} AND id = ${b.response?.id}`;
        if (!k.length) return send(res, 401, { error: "Cette empreinte n'est pas enregistrée pour cette app. Utilise ton code." });
        const v = await verifyAuthenticationResponse({
          response: b.response, expectedChallenge: ch[0].challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
          credential: { id: k[0].id, publicKey: new Uint8Array(Buffer.from(k[0].public_key, 'base64url')), counter: Number(k[0].counter), transports: k[0].transports ? k[0].transports.split(',') : undefined }
        });
        if (!v.verified) return send(res, 401, { error: 'Empreinte refusée.' });
        await q`UPDATE passkeys SET counter = ${v.authenticationInfo.newCounter}, last_used = now() WHERE app = ${APP} AND id = ${k[0].id}`;
        const token = await createSession(req);
        return send(res, 200, { ok: true }, { 'set-cookie': sessionCookie(token) });
      }
      case 'logout': {
        const t = cookies(req)['hsess_' + APP];
        if (t) await q`DELETE FROM sessions WHERE token_hash = ${sha(t)}`;
        return send(res, 200, { ok: true }, { 'set-cookie': clearCookie() });
      }
      default: return send(res, 400, { error: 'Demande inconnue.' });
    }
  } catch (e) {
    console.error('auth', b.action, e?.message);
    return send(res, 500, { error: "Le verrou a rencontré un problème. Réessaie, ou utilise ton code." });
  }
}
