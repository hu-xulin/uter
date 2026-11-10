/* 测试夹具：把统一需求模型复制到临时目录，保证自动化测试不污染真实产品数据。 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const REAL_MODEL = path.join(ROOT, 'docs/product/registry/product-model.json');
export const REAL_HISTORY = path.join(ROOT, 'docs/product/history');
export const WORKSPACE = path.join(ROOT, 'tools/product-workspace');

let seq = 0;
export function makeIsolatedEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uter-product-test-'));
  const modelPath = path.join(dir, 'product-model.json');
  const historyDir = path.join(dir, 'history');
  fs.mkdirSync(historyDir, { recursive: true });
  fs.copyFileSync(REAL_MODEL, modelPath);
  if (fs.existsSync(REAL_HISTORY)) {
    for (const name of fs.readdirSync(REAL_HISTORY)) {
      if (name.endsWith('.json')) fs.copyFileSync(path.join(REAL_HISTORY, name), path.join(historyDir, name));
    }
  }
  process.env.UTER_PRODUCT_MODEL_PATH = modelPath;
  process.env.UTER_PRODUCT_HISTORY_DIR = historyDir;
  process.env.UTER_PRODUCT_WORKSPACE_NO_PROJECTIONS = '1';
  return {
    dir, modelPath, historyDir, tag: `${process.pid}-${Date.now()}-${seq++}`,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** 每次返回独立的 engine 模块实例（query 避免 ESM 缓存复用旧 MODEL_FILE）。 */
export async function loadEngine() {
  const env = makeIsolatedEnv();
  const engine = await import(`../engine.mjs?isolated=${env.tag}`);
  return { ...env, engine };
}

/** 直接把隔离环境挂到 server.mjs 使用的 engine 实例（需在任何 engine import 之前调用）。 */
export async function loadServer() {
  const env = makeIsolatedEnv();
  const server = await import(`../server.mjs?isolated=${env.tag}`);
  const engine = await import(`../engine.mjs?isolated=${env.tag}`);
  return { ...env, server, engine };
}

export function change(ch, extra = {}) {
  return {
    source_view: 'PRD', actor: 'tester', role: 'admin', reason: '自动化测试',
    ...ch, ...extra,
  };
}
