import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { Web3 } from 'web3';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface Sandbox {
  id: string;
  port: number;
  rpcUrl: string;
  accounts: { address: string; privateKey: string }[];
  proc: ChildProcessWithoutNullStreams;
  createdAt: number;
  lastActiveAt: number;
}

const sandboxes = new Map<string, Sandbox>();
const usedPorts = new Set<number>();

function pickPort(): number {
  for (let i = 0; i < env.ganache.portRange; i++) {
    const p = env.ganache.portBase + i;
    if (!usedPorts.has(p)) return p;
  }
  throw new Error('No free port for Ganache');
}

const DEFAULT_KEYS = [
  '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
  '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
  '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c',
  '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913',
  '0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743',
];

export async function createSandbox(userId: number): Promise<Sandbox> {
  const port = pickPort();
  usedPorts.add(port);
  const id = `sb-${userId}-${port}-${Date.now()}`;

  const args = [
    '--server.host', '127.0.0.1',
    '--server.port', String(port),
    '--chain.networkId', String(1337 + (port - env.ganache.portBase)),
    '--chain.chainId', '1337',
    '--wallet.accounts',
    ...DEFAULT_KEYS.map((k) => `${k},100000000000000000000`),
    '--logging.quiet', 'true',
  ];

  const proc = spawn(env.ganache.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (d) => logger.debug(`[${id}] ${d.toString().trim()}`));
  proc.stderr.on('data', (d) => logger.debug(`[${id} err] ${d.toString().trim()}`));
  proc.on('exit', (code) => {
    logger.info(`Ganache ${id} exited`, { code });
    usedPorts.delete(port);
    sandboxes.delete(id);
  });

  // Wait until JSON-RPC is reachable
  const rpcUrl = `http://127.0.0.1:${port}`;
  const w3 = new Web3(rpcUrl);
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    try {
      await w3.eth.net.getId();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  const accounts = DEFAULT_KEYS.map((pk) => ({
    address: w3.eth.accounts.privateKeyToAccount(pk).address,
    privateKey: pk,
  }));

  const sb: Sandbox = {
    id,
    port,
    rpcUrl,
    accounts,
    proc,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  sandboxes.set(id, sb);
  logger.info('sandbox created', { id, port });
  return sb;
}

export function getSandbox(id: string): Sandbox | undefined {
  const sb = sandboxes.get(id);
  if (sb) sb.lastActiveAt = Date.now();
  return sb;
}

export function destroySandbox(id: string): boolean {
  const sb = sandboxes.get(id);
  if (!sb) return false;
  try {
    sb.proc.kill('SIGKILL');
  } catch {/* noop */}
  sandboxes.delete(id);
  usedPorts.delete(sb.port);
  return true;
}

export function listSandboxes(userId?: number) {
  const list = [...sandboxes.values()];
  return userId === undefined ? list : list.filter((s) => s.id.startsWith(`sb-${userId}-`));
}

// idle GC
setInterval(() => {
  const now = Date.now();
  for (const sb of sandboxes.values()) {
    if (now - sb.lastActiveAt > env.ganache.idleTtlMs) {
      logger.info('sandbox idle gc', { id: sb.id });
      destroySandbox(sb.id);
    }
  }
}, 60_000).unref();
