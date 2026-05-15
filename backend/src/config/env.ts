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
    // 共享链 RPC（Ganache GUI Quickstart 默认 7545）
    rpcUrl: process.env.GANACHE_RPC_URL ?? 'http://127.0.0.1:7545',
    port: Number(process.env.GANACHE_PORT ?? 7545),
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
