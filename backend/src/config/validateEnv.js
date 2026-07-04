/**
 * @file config/validateEnv.js
 * @description Startup environment variable validator.
 *
 *   Called once — synchronously — at process boot before any module reads
 *   `process.env`.  If required variables are absent or malformed the
 *   validator prints a formatted diagnostic and terminates the process
 *   immediately (fail-fast), preventing the app from starting in a broken
 *   state.
 *
 *   Each rule describes:
 *     name     — the environment variable key
 *     required — whether the app cannot start without it
 *     validate — optional fn(value) that returns an error string or null
 *     hint     — shown in the error table to guide the developer
 */

// ── Validation Rules ──────────────────────────────────────────────────────────

const RULES = [
  {
    name: 'PORT',
    required: true,
    hint: 'Must be a valid port number between 1 and 65535 (e.g. PORT=5000)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        return `'${v}' is not a valid port (expected integer 1–65535)`;
      }
      return null;
    },
  },
  {
    name: 'MONGO_URI',
    required: true,
    hint: 'MongoDB connection string (e.g. MONGO_URI=mongodb://localhost:27017/mydb)',
    validate: (v) => {
      if (!v.startsWith('mongodb://') && !v.startsWith('mongodb+srv://')) {
        return `'${v}' does not look like a MongoDB URI (must start with mongodb:// or mongodb+srv://)`;
      }
      return null;
    },
  },
  {
    name: 'JWT_SECRET',
    required: true,
    hint: 'Random, unpredictable string ≥ 32 characters (e.g. openssl rand -hex 32)',
    validate: (v) => {
      if (v.length < 32) {
        return `JWT_SECRET is too short (${v.length} chars — minimum 32 required for security)`;
      }
      return null;
    },
  },
  // ── Optional but validated when present ────────────────────────────────────
  {
    name: 'NODE_ENV',
    required: false,
    hint: "One of: development | test | production (defaults to 'development')",
    validate: (v) => {
      const allowed = ['development', 'test', 'production'];
      if (!allowed.includes(v)) {
        return `'${v}' is not a recognised NODE_ENV value (allowed: ${allowed.join(', ')})`;
      }
      return null;
    },
  },
  {
    name: 'JWT_EXPIRES_IN',
    required: false,
    hint: "Token TTL in vercel/ms format (e.g. 7d, 24h, 3600s — defaults to '7d')",
    validate: (v) => {
      if (!/^\d+[smhd]$/.test(v)) {
        return `'${v}' is not a valid duration string (expected format: 7d / 24h / 3600s)`;
      }
      return null;
    },
  },
  {
    name: 'GEMINI_API_KEY',
    required: false,
    hint: 'Google Gemini API key (e.g. GEMINI_API_KEY=AIzaSy...)',
    validate: (v) => {
      if (v.length < 10) {
        return `GEMINI_API_KEY is too short (${v.length} chars)`;
      }
      return null;
    },
  },
  {
    name: 'GROQ_API_KEY',
    required: false,
    hint: 'Groq Cloud API key (e.g. GROQ_API_KEY=gsk_...)',
    validate: (v) => {
      if (v.length < 10) {
        return `GROQ_API_KEY is too short (${v.length} chars)`;
      }
      return null;
    },
  },
  {
    name: 'RATE_LIMIT_AUTH_WINDOW_MS',
    required: false,
    hint: 'Time window in milliseconds for authentication rate limit (e.g. 900000)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
  {
    name: 'RATE_LIMIT_AUTH_MAX',
    required: false,
    hint: 'Max requests allowed in auth rate limit window (e.g. 20)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
  {
    name: 'RATE_LIMIT_CHAT_WINDOW_MS',
    required: false,
    hint: 'Time window in milliseconds for chat rate limit (e.g. 60000)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
  {
    name: 'RATE_LIMIT_CHAT_MAX',
    required: false,
    hint: 'Max requests allowed in chat rate limit window (e.g. 30)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
  {
    name: 'RATE_LIMIT_UPLOAD_WINDOW_MS',
    required: false,
    hint: 'Time window in milliseconds for document upload rate limit (e.g. 900000)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
  {
    name: 'RATE_LIMIT_UPLOAD_MAX',
    required: false,
    hint: 'Max requests allowed in upload rate limit window (e.g. 10)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
  {
    name: 'CHAT_CACHE_TTL_SEC',
    required: false,
    hint: 'Cache expiration time in seconds for repeated chat queries (e.g. 300)',
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) {
        return `'${v}' must be a valid positive integer`;
      }
      return null;
    },
  },
];

// ── Formatter ─────────────────────────────────────────────────────────────────

const BORDER = '═'.repeat(60);
const THIN   = '─'.repeat(60);

/**
 * Print a formatted validation failure report to stderr and exit.
 *
 * @param {{ name: string, kind: 'missing'|'invalid', message: string, hint: string }[]} failures
 */
const failWithReport = (failures) => {
  process.stderr.write('\n');
  process.stderr.write(`╔${BORDER}╗\n`);
  process.stderr.write(`║  ✖  ENVIRONMENT VALIDATION FAILED${' '.repeat(24)}║\n`);
  process.stderr.write(`║  The application cannot start until these are fixed.${' '.repeat(7)}║\n`);
  process.stderr.write(`╚${BORDER}╝\n\n`);

  failures.forEach((f, i) => {
    const label = f.kind === 'missing' ? 'MISSING' : 'INVALID';
    process.stderr.write(`  ${i + 1}. [${label}] ${f.name}\n`);
    process.stderr.write(`     Problem : ${f.message}\n`);
    process.stderr.write(`     Fix     : ${f.hint}\n`);
    if (i < failures.length - 1) process.stderr.write(`     ${THIN}\n`);
  });

  process.stderr.write('\n');
  process.stderr.write(`  ➜  Rename .env.example to .env and fill in the values.\n`);
  process.stderr.write(`  ➜  Then restart the server.\n`);
  process.stderr.write('\n');

  process.exit(1);
};

// ── Main Validator ────────────────────────────────────────────────────────────

/**
 * Validates all defined rules against `process.env`.
 * Exits the process immediately if any required variable is missing or any
 * variable (required or optional-but-present) fails its format check.
 *
 * @returns {void}  Never throws — any problem exits the process.
 */
const validateEnv = () => {
  const failures = [];

  for (const rule of RULES) {
    const value = process.env[rule.name];
    const isMissing = value === undefined || value.trim() === '';

    if (isMissing) {
      if (rule.required) {
        failures.push({
          name:    rule.name,
          kind:    'missing',
          message: `${rule.name} is not set in the environment.`,
          hint:    rule.hint,
        });
      }
      // Optional and missing — skip format check
      continue;
    }

    // Variable is present — run format validation if defined
    if (rule.validate) {
      const errorMsg = rule.validate(value.trim());
      if (errorMsg) {
        failures.push({
          name:    rule.name,
          kind:    'invalid',
          message: errorMsg,
          hint:    rule.hint,
        });
      }
    }
  }

  if (failures.length > 0) {
    failWithReport(failures);
  }
};

module.exports = validateEnv;
