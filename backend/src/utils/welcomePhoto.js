import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Welcome image shipped with the backend (backend/assets/caloria-welcome.jpg). */
export const WELCOME_PHOTO_PATH = path.resolve(__dirname, '../../assets/caloria-welcome.jpg');

let lastError = null;
let lastErrorAt = null;
let lastSuccessAt = null;

export function hasWelcomePhoto() {
  return existsSync(WELCOME_PHOTO_PATH);
}

export function noteWelcomePhotoError(message) {
  lastError = String(message || 'unknown error').slice(0, 300);
  lastErrorAt = new Date().toISOString();
}

export function noteWelcomePhotoSuccess() {
  lastError = null;
  lastErrorAt = null;
  lastSuccessAt = new Date().toISOString();
}

/** Diagnostics exposed through /api/health; contains no secrets. */
export function getWelcomePhotoStatus() {
  let bytes = 0;
  let exists = false;
  try {
    bytes = statSync(WELCOME_PHOTO_PATH).size;
    exists = true;
  } catch {
    exists = false;
  }
  return {
    exists,
    bytes,
    lastError,
    lastErrorAt,
    lastSuccessAt,
  };
}