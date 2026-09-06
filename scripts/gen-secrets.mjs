// Generates APP_PASSWORD_HASH, APP_PASSWORD_SALT, and APP_ENCRYPTION_KEY
// Uses the same PBKDF2 + AES-GCM logic as lib/server.ts

const PASSWORD = 'CLEVERCLOUDS.IN2026!';
const encoder = new TextEncoder();

const hex = (data) =>
  Array.from(new Uint8Array(data), (v) => v.toString(16).padStart(2, '0')).join('');

// --- Salt: random 32-byte string (hex) ---
const saltBytes = crypto.getRandomValues(new Uint8Array(32));
const APP_PASSWORD_SALT = hex(saltBytes.buffer);

// --- PBKDF2 hash of password with that salt ---
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
const APP_PASSWORD_HASH = hex(hashBits);

// --- AES-GCM 256-bit encryption key ---
const rawKey = crypto.getRandomValues(new Uint8Array(32));
const APP_ENCRYPTION_KEY = btoa(String.fromCharCode(...rawKey));

console.log('APP_PASSWORD_SALT=' + APP_PASSWORD_SALT);
console.log('APP_PASSWORD_HASH=' + APP_PASSWORD_HASH);
console.log('APP_ENCRYPTION_KEY=' + APP_ENCRYPTION_KEY);
