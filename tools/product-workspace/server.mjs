/*
 * UTER Product Workspace — 本地服务（零外部依赖）
 *
 * 同时提供：
 *  1) 产品规格中心 SPA（静态资源，遵循 UDS 8.0.0 tokens）
 *  2) 统一需求模型 REST API（读写唯一数据源 product-model.json）
 *
 * 启动：node tools/product-workspace/server.mjs [--port 7788]
 * 访问：http://127.0.0.1:7788/
 *
 * 权限边界（内部工具基线）：
 *  - 服务默认只绑定 127.0.0.1，不对外暴露。
 *  - 读接口：本机可读；配置 UTER_PRODUCT_WORKSPACE_TOKEN 后需 Bearer Token。
 *  - 写接口：必须携带 X-Uter-Role: admin（或 body.role=admin）。
 *  - 生产接入时必须替换为 Uter 现有 session + Casbin 鉴权；此基线不向
 *    普通用户开放内部 PRD / 架构 / 管理信息的编辑能力（见最终报告 P1）。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from './engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');
const ROOT = engine.ROOT;
const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
export const PORT = Number(portArg >= 0 ? argv[portArg + 1] : (process.env.UTER_PRODUCT_WORKSPACE_PORT || 7788));
export const TOKEN = process.env.UTER_PRODUCT_WORKSPACE_TOKEN || '';
const MAX_BODY = 2 * 1024 * 1024;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Uter-Role', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > MAX_BODY) { reject(new Error('请求体过大')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON 解析失败: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function auth(req, body, write) {
  const remote = req.socket.remoteAddress || '';
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (!loopback) return { ok: false, reason: '仅允许本机访问（内部产品资料）' };
  if (TOKEN) {
    const h = req.headers.authorization || '';
    if (h !== `Bearer ${TOKEN}`) return { ok: false, reason: '缺少或错误的访问令牌' };
  }
  if (write) {
    const role = req.headers['x-uter-role'] || body?.role || '';
    if (String(role).toLowerCase() !== 'admin') return { ok: false, reason: '写操作需要管理员角色（X-Uter-Role: admin）' };
  }
  return { ok: true };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);

    // ── 交互式 HTML 原型（docs/product/prototypes/**，只读、限 .html、防路径越界）──
    if (pathname.startsWith('/docs/product/prototypes/')) {
      const base = path.join(ROOT, 'docs/product/prototypes');
      const rel = pathname.replace(/^\/docs\/product\/prototypes\//, '');
      const file = path.resolve(base, rel);
      if (!file.startsWith(base + path.sep) || !file.endsWith('.html')) return send(res, 403, { error: '路径越界' });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: '原型不存在', path: rel });
      return send(res, 200, fs.readFileSync(file), MIME['.html']);
    }

    // ── 静态 SPA ──
    if (!pathname.startsWith('/api/')) {
      let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const file = path.resolve(PUBLIC, rel);
      if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: '路径越界' });
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        // 前端路由 fallback
        const index = path.join(PUBLIC, 'index.html');
        return send(res, 200, fs.readFileSync(index), MIME['.html']);
      }
      return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    }

    // ── API ──
    let body = {};
    if (req.method === 'POST') {
      try { body = await parseBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
    }
    const write = req.method === 'POST';
    const guard = auth(req, body, write);
    if (!guard.ok) return send(res, 403, { error: guard.reason, hint: '内部 PRD / 架构 / 管理信息不向普通用户开放' });

    const model = engine.readModel();
    try {
      if (pathname === '/api/health' && req.method === 'GET') {
        return send(res, 200, { ok: true, service: 'UTER Product Workspace', port: PORT, model_version: model.model_version, features: model.features.length, token_required: !!TOKEN, design_system: model.design_system });
      }
      if (pathname === '/api/model' && req.method === 'GET') return send(res, 200, model);
      if (pathname === '/api/features' && req.method === 'GET') {
        const list = model.features.map((f) => ({
          feature_id: f.feature_id, name: f.name, domain: f.domain, module: f.module, status: f.status,
          priority: f.priority, roles: f.roles, prd_status: f.prd.status, prd_version: f.prd.version,
          prototype_status: f.prototype.pages[0]?.status, pages: f.prototype.pages.length,
          requirements: f.requirements.length, acceptance: f.acceptance.length, tests: f.tests.length,
          mapping_status: f.mapping.requirement_to_page && Object.keys(f.mapping.requirement_to_page).length ? 'MAPPED' : 'MISSING',
          sync_status: f.sync_status, acceptance_status: f.acceptance.length ? 'DEFINED' : 'MISSING',
          evidence: f.evidence, status_note: f.status_note, open_decisions: f.open_decisions,
        }));
        return send(res, 200, { total: list.length, features: list });
      }
      const fm = pathname.match(/^\/api\/features\/(UTER-[A-Z]+-\d{3})$/);
      if (fm && req.method === 'GET') {
        const f = model.features.find((x) => x.feature_id === fm[1]);
        return f ? send(res, 200, f) : send(res, 404, { error: 'Feature 不存在', feature_id: fm[1] });
      }
      if (pathname === '/api/coverage' && req.method === 'GET') return send(res, 200, engine.coverage(model));
      if (pathname === '/api/validate' && req.method === 'GET') {
        return send(res, 200, engine.validate(model, url.searchParams.get('feature'), { checkFiles: url.searchParams.get('files') === '1' }));
      }
      if (pathname === '/api/mappings' && req.method === 'GET') return send(res, 200, { total: model.mappings.length, mappings: model.mappings });
      if (pathname === '/api/changes' && req.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 200);
        return send(res, 200, { total: model.changes.length, changes: model.changes.slice(-limit).reverse() });
      }
      if (pathname === '/api/versions' && req.method === 'GET') {
        return send(res, 200, { current: model.model_version, snapshots: model.snapshots });
      }
      if (pathname === '/api/conflicts' && req.method === 'GET') return send(res, 200, { total: model.conflicts.length, conflicts: model.conflicts });
      if (pathname === '/api/sync-status' && req.method === 'GET') {
        const fid = url.searchParams.get('feature');
        if (!fid) return send(res, 400, { error: '缺少 feature 参数' });
        const s = engine.syncStatus(model, fid);
        return s ? send(res, 200, s) : send(res, 404, { error: 'Feature 不存在' });
      }
      if (pathname === '/api/gate' && req.method === 'POST') return send(res, 200, engine.gate(model, body));
      if (pathname === '/api/change' && req.method === 'POST') {
        const { role, ...ch } = body;
        if (!ch.op || !ch.feature_id) return send(res, 400, { error: '缺少 op / feature_id' });
        const out = engine.applyChange(model, ch);
        const code = out.status === 'FAILED' ? 422 : out.status === 'CONFLICT' ? 409 : 200;
        return send(res, code, out);
      }
      if (pathname === '/api/conflicts/resolve' && req.method === 'POST') {
        const out = engine.resolveConflict(model, body);
        return send(res, out.status === 'FAILED' ? 422 : 200, out);
      }
      if (pathname === '/api/restore' && req.method === 'POST') {
        const out = engine.restoreVersion(model, body);
        return send(res, out.status === 'FAILED' ? 422 : 200, out);
      }
      return send(res, 404, { error: '未知接口', path: pathname });
    } catch (e) {
      return send(res, 500, { error: '服务端异常', message: e.message, stack: e.stack?.split('\n').slice(0, 4) });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!fs.existsSync(engine.MODEL_FILE)) {
    console.error('[product-workspace] 缺少统一需求模型，请先运行 node tools/product-workspace/build-model.mjs');
    process.exit(1);
  }
  const server = createServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[product-workspace] UTER 产品规格中心已启动: http://127.0.0.1:${PORT}/`);
    console.log(`[product-workspace] 统一需求模型: ${path.relative(ROOT, engine.MODEL_FILE)} (v${engine.readModel().model_version})`);
    console.log(`[product-workspace] 写操作需要 X-Uter-Role: admin${TOKEN ? ' + Bearer Token' : ''}`);
  });
}
