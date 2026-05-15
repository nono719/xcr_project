import { Web3 } from 'web3';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * 共享链模式（适配 Ganache GUI / 单一 RPC 端点）
 * - 不为每个实验启动子进程
 * - 通过 evm_snapshot / evm_revert 在共享链上做逻辑隔离
 * - 账户来自 Ganache 工作区，私钥由 RPC 节点托管（accounts 已 unlock）
 */
export interface SandboxAccount {
  address: string;
  privateKey?: string; // 仅在 Ganache 通过 personal_listAccounts/真实私钥可知时填充
}

export interface Sandbox {
  id: string;
  rpcUrl: string;
  port: number;
  snapshotId?: string;
  accounts: SandboxAccount[];
  createdAt: number;
  lastActiveAt: number;
}

const sandboxes = new Map<string, Sandbox>();

async function rpc<T = unknown>(w3: Web3, method: string, params: unknown[] = []): Promise<T | undefined> {
  try {
    const r: any = await (w3.currentProvider as any).request({ method, params });
    return (typeof r === 'object' && r !== null && 'result' in r ? r.result : r) as T;
  } catch (e) {
    logger.debug(`rpc ${method} failed`, { err: (e as Error).message });
    return undefined;
  }
}

export async function createSandbox(userId: number): Promise<Sandbox> {
  const rpcUrl = env.ganache.rpcUrl;
  const w3 = new Web3(rpcUrl);
  try {
    await w3.eth.net.getId();
  } catch (e) {
    throw new Error(`无法连接 Ganache RPC ${rpcUrl}，请先在 Ganache GUI 启动 Quickstart`);
  }

  const id = `sb-${userId}-${Date.now()}`;
  const snapshotId = await rpc<string>(w3, 'evm_snapshot', []);

  const addresses = await w3.eth.getAccounts();
  const accounts: SandboxAccount[] = addresses.slice(0, 5).map((address) => ({ address }));

  const sb: Sandbox = {
    id,
    rpcUrl,
    port: env.ganache.port,
    snapshotId,
    accounts,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  sandboxes.set(id, sb);
  logger.info('sandbox created (shared chain)', { id, snapshotId, accounts: addresses.length });
  return sb;
}

export function getSandbox(id: string): Sandbox | undefined {
  const sb = sandboxes.get(id);
  if (sb) sb.lastActiveAt = Date.now();
  return sb;
}

export async function destroySandbox(id: string): Promise<boolean> {
  const sb = sandboxes.get(id);
  if (!sb) return false;
  if (sb.snapshotId) {
    try {
      const w3 = new Web3(sb.rpcUrl);
      await rpc(w3, 'evm_revert', [sb.snapshotId]);
    } catch {/* ignore */}
  }
  sandboxes.delete(id);
  logger.info('sandbox destroyed', { id });
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
      destroySandbox(sb.id).catch(() => {/* ignore */});
    }
  }
}, 60_000).unref();
