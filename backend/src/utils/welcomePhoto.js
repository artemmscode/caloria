import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Welcome image shipped with the backend (backend/assets/caloria-welcome.jpg). */
export const WELCOME_PHOTO_PATH = path.resolve(__dirname, '../../assets/caloria-welcome.jpg');

export function hasWelcomePhoto() {
  return existsSync(WELCOME_PHOTO_PATH);
}