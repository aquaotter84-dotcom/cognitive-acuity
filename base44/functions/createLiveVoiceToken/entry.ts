import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// LiveKit room tokens are HS256-signed JWTs. We build one with Web Crypto so no
// external dependency is needed. Claims follow the livekit-server-sdk shape:
// iss (api key), sub (identity), video grant (room + permissions), metadata.

function b64url(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToB64url(obj) {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64url(sig);
}

async function createLiveKitToken({ apiKey, apiSecret, identity, name, roomName, ttl, metadata }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: apiKey,
    sub: identity,
    name,
    iat: now,
    nbf: now,
    exp: now + ttl,
    jti: crypto.randomUUID(),
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true
    }
  };
  if (metadata) payload.metadata = metadata;
  const signingInput = `${strToB64url(header)}.${strToB64url(payload)}`;
  const sig = await hmacSha256(apiSecret, signingInput);
  return `${signingInput}.${sig}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('LIVEKIT_API_KEY');
    const apiSecret = secrets.get('LIVEKIT_API_SECRET');
    let url = secrets.get('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !url) {
      return Response.json({ error: 'LiveKit credentials are not configured' }, { status: 500 });
    }
    // LiveKit expects a WebSocket URL; accept a bare hostname too.
    if (!/^wss?:\/\//i.test(url)) url = 'wss://' + url.replace(/^\/+/, '');

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId;
    const conversationId = body.conversationId || null;
    const style = body.style || 'balanced';
    if (!workspaceId) return Response.json({ error: 'workspaceId is required' }, { status: 400 });

    const identity = user.id;
    const name = user.full_name || user.email || 'Cognos User';
    const roomName = `cognos-${workspaceId}-${Math.random().toString(36).slice(2, 10)}`;
    const metadata = JSON.stringify({ workspaceId, conversationId, style, userId: user.id });

    const token = await createLiveKitToken({
      apiKey,
      apiSecret,
      identity,
      name,
      roomName,
      ttl: 60 * 60 * 4, // 4 hours
      metadata
    });

    return Response.json({ url, token, roomName, identity });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}