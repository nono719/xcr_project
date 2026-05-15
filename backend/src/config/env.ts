import 'dotenv/config';

const required = (key: string, def?: string): string => {
  const v = process.env[key] ?? def;
  if (v === undefined) throw new Error(`Missing env: ${key}`);
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    database: required('DB_NAME', 'xcr_system'),
  },
  jwt: {
    secret: required('JWT_SECRET', 'dev-only-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  },
  ganache: {
    bin: process.env.GANACHE_BIN ?? 'ganache',
    portBase: Number(process.env.GANACHE_PORT_BASE ?? 8600),
    portRange: Number(process.env.GANACHE_PORT_RANGE ?? 200),
    idleTtlMs: Number(process.env.SANDBOX_IDLE_TTL_MS ?? 900_000),
  },
  solc: {
    version: process.env.SOLC_VERSION ?? '0.8.20',
  },
  log: {
    dir: process.env.LOG_DIR ?? './logs',
    retentionDays: Number(process.env.LOG_RETENTION_DAYS ?? 90),
  },
};
