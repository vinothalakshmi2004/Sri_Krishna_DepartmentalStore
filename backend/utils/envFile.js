/**
 * Read / update the backend .env file (used by the System Settings screen).
 *
 * Changes are written to disk only - the running server keeps using the old
 * values until it is restarted. A copy of the previous file is kept in
 * .env.backup so a bad value can be undone by hand.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_PATH = path.join(__dirname, '..', '.env');
const BACKUP_PATH = path.join(__dirname, '..', '.env.backup');

// Only these keys can be changed from the admin panel
const EDITABLE_ENV_KEYS = ['PORT', 'MONGO_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'CLIENT_URL'];

/** Raw .env file content ('' when the file does not exist). */
const readEnvFile = async () => {
  try {
    return await fs.promises.readFile(ENV_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
};

/** Parsed key/value pairs of the .env file. */
const readEnvValues = async () => dotenv.parse(await readEnvFile());

/** Quote values containing spaces or "#" so dotenv reads them back correctly. */
const formatEnvValue = (value) => (/[\s#]/.test(value) ? `"${value}"` : value);

/**
 * Replace (or append) the given keys in .env, keeping comments, ordering and
 * every other line untouched.
 * @param {Object<string,string>} updates e.g. { PORT: '5001' }
 */
const updateEnvFile = async (updates) => {
  const original = await readEnvFile();
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original ? original.split(/\r?\n/) : [];
  const written = new Set();

  const output = lines.map((line) => {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match && Object.prototype.hasOwnProperty.call(updates, match[1])) {
      written.add(match[1]);
      return `${match[1]}=${formatEnvValue(updates[match[1]])}`;
    }
    return line;
  });

  // Drop trailing blank lines, then append keys that were not in the file yet
  while (output.length && output[output.length - 1].trim() === '') output.pop();
  Object.entries(updates).forEach(([key, value]) => {
    if (!written.has(key)) output.push(`${key}=${formatEnvValue(value)}`);
  });

  const content = output.join(eol) + eol;
  if (original) await fs.promises.writeFile(BACKUP_PATH, original, 'utf8');

  // Write to a temp file first, then swap it in (avoids half-written .env)
  const tempPath = `${ENV_PATH}.tmp`;
  await fs.promises.writeFile(tempPath, content, 'utf8');
  try {
    await fs.promises.rename(tempPath, ENV_PATH);
  } catch (err) {
    // Windows may refuse the rename if an editor has .env open - write directly
    await fs.promises.writeFile(ENV_PATH, content, 'utf8');
    await fs.promises.unlink(tempPath).catch(() => {});
  }
};

/** mongodb://user:pass@host/db?x=y -> mongodb://user:****@host/db */
const maskMongoUri = (uri) => {
  if (!uri) return '';
  const match = /^(mongodb(?:\+srv)?:\/\/)(?:([^@/]+)@)?([^/?]+)(\/[^?]*)?/.exec(uri);
  if (!match) return '****';
  const [, scheme, credentials, hosts, dbPath = ''] = match;
  let maskedCredentials = '';
  if (credentials) {
    const user = decodeURIComponent(credentials.split(':')[0]);
    maskedCredentials = `${user}:****@`;
  }
  return `${scheme}${maskedCredentials}${hosts}${dbPath}`;
};

/** "my_super_secret_value" -> "my_***************lue" */
const maskSecret = (secret) => {
  if (!secret) return '';
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 3)}${'*'.repeat(Math.max(4, secret.length - 6))}${secret.slice(-3)}`;
};

module.exports = {
  ENV_PATH,
  EDITABLE_ENV_KEYS,
  readEnvValues,
  updateEnvFile,
  maskMongoUri,
  maskSecret,
};
