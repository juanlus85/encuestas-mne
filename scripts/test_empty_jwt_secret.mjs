import { SignJWT } from 'jose';

try {
  const token = await new SignJWT({ openId: 'local-juanlu', appId: 'local-app', name: 'Juanlu' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(Math.floor((Date.now() + 60_000) / 1000))
    .sign(new TextEncoder().encode(''));
  console.log('ok', token.length);
} catch (error) {
  console.error('error', error);
}
