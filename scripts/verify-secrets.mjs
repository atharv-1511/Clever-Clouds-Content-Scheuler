// Verify the generated secrets work for login
const PASSWORD = 'CLEVERCLOUDS.IN2026!';
const encoder = new TextEncoder();

const hex = (data) =>
  Array.from(new Uint8Array(data), (v) => v.toString(16).padStart(2, '0')).join('');

const APP_PASSWORD_SALT = process.env.APP_PASSWORD_SALT;
const APP_PASSWORD_HASH = process.env.APP_PASSWORD_HASH;
const APP_ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;

console.log('Testing with password:', PASSWORD);
console.log('Salt set:', !!APP_PASSWORD_SALT);
console.log('Hash set:', !!APP_PASSWORD_HASH);
console.log('Key set:', !!APP_ENCRYPTION_KEY);

// Reproduce passwordMatches from lib/server.ts
const key = await crypto.subtle.importKey(
  'raw',
  encoder.encode(PASSWORD),
  'PBKDF2',
  false,
  ['deriveBits'],
);
const hashBits = await crypto.subtle.deriveBits(
  {
    name: 'PBKDF2',
    salt: encoder.encode(APP_PASSWORD_SALT),
    iterations: 100000,
    hash: 'SHA-256',
  },
  key,
  256,
);
const hash = hex(hashBits);

let diff = hash.length ^ APP_PASSWORD_HASH.length;
for (let i = 0; i < hash.length; i++)
  diff |= hash.charCodeAt(i) ^ APP_PASSWORD_HASH.charCodeAt(i);

console.log('\n✅ Password matches:', diff === 0);

// Test AES-GCM key import
const rawKey = Uint8Array.from(atob(APP_ENCRYPTION_KEY), c => c.charCodeAt(0));
const cryptoKey = await crypto.subtle.importKey(
  'raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
);
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  cryptoKey,
  encoder.encode('{"test":"value"}'),
);
const decrypted = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv },
  cryptoKey,
  encrypted,
);
console.log('✅ Encryption key works:', new TextDecoder().decode(decrypted));
