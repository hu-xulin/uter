/*
 * 自动化测试 · 交互式 HTML 原型 与 PRD 的对应关系
 * 1) 56 份 HTML 存在，与 PRD 一一对应：同 Feature ID、PRD 路径、需求块、组件标记
 * 2) 双向定位钩子完整（左侧组件 ↔ 右侧需求/验收/页面）
 * 3) 自包含零外部依赖、DEMO/MOCK 标记、校验规则与 PRD 业务规则同源
 * 4) 服务端安全路由：/docs/product/prototypes/**（只读、限 .html、防越界）
 * 5) 真实浏览器：双栏、表单校验、MOCK 弹窗、状态与视口切换、双向定位
 * HTML 为只读投影，测试直接读取真实产物；涉及写路径的接口均使用隔离模型。
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, loadServer } from './helpers.mjs';
import { prototypeHTMLPath } from '../render-html.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, 'web/node_modules/playwright'));

const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/product/registry/product-model.json'), 'utf8'));
const htmlOf = (f) => fs.readFileSync(path.join(ROOT, prototypeHTMLPath(f)), 'utf8');

let ctx, srv, base, browser, page;

before(async () => {
  ctx = await loadServer();
  srv = ctx.server.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => srv.close(resolve));
  ctx.cleanup();
});

describe('HTML 原型 · 与 PRD 一一对应', () => {
  test('每个 Feature 都有同名 HTML 原型且同目录对应 .md 说明', () => {
    for (const f of model.features) {
      const hp = path.join(ROOT, prototypeHTMLPath(f));
      const mp = path.join(ROOT, `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`);
      assert.ok(fs.existsSync(hp), `缺少交互式 HTML 原型: ${prototypeHTMLPath(f)}`);
      assert.ok(fs.existsSync(mp), `缺少原型说明: ${mp}`);
    }
    assert.equal(model.features.length, 56);
  });

  test('HTML 与 PRD 同源：Feature ID、PRD 路径、DEMO 标记、需求块逐条对应', () => {
    for (const f of model.features) {
      const html = htmlOf(f);
      assert.ok(html.includes(`data-feature-id="${f.feature_id}"`), `${f.feature_id}: 缺少 Feature ID 标记`);
      assert.ok(html.includes(`data-prd-path="${f.prd.path}"`), `${f.feature_id}: 缺少 PRD 路径对应`);
      assert.ok(html.includes(`href="${f.prd.path}"`), `${f.feature_id}: 缺少 PRD Markdown 链接`);
      assert.ok(html.includes('data-demo="MOCK"'), `${f.feature_id}: 缺少 DEMO/MOCK 标记`);
      const missing = f.requirements
        .filter((q) => q.status !== 'DEPRECATED')
        .filter((q) => !html.includes(`id="req-${q.requirement_id}"`));
      assert.deepEqual(missing, [], `${f.feature_id}: HTML 缺少需求块 ${missing.join(',')}`);
    }
  });

  test('双向定位钩子：左侧组件标记数与模型一致，右侧需求块带组件/页面映射', () => {
    for (const f of model.features) {
      const html = htmlOf(f);
      const active = f.prototype.pages.flatMap((p) => p.components.filter((c) => c.status !== 'DEPRECATED'));
      const marks = html.match(/data-component-id="CMP-/g) || [];
      assert.equal(marks.length, active.length, `${f.feature_id}: 组件标记数与模型不一致`);
      const reqBlocks = html.match(/<details class="req" id="req-/g) || [];
      assert.equal(reqBlocks.length, f.requirements.filter((q) => q.status !== 'DEPRECATED').length, `${f.feature_id}: 需求块数不一致`);
      for (const q of f.requirements.filter((x) => x.status !== 'DEPRECATED' && (x.component_ids || []).length)) {
        const block = html.slice(html.indexOf(`id="req-${q.requirement_id}"`), html.indexOf(`id="req-${q.requirement_id}"`) + 4000);
        assert.ok((q.component_ids || []).every((cid) => block.includes(`data-loc-cmp="${cid}"`)),
          `${f.feature_id}/${q.requirement_id}: 需求块缺少组件定位钩子`);
      }
    }
  });

  test('自包含零外部依赖，交互控件与 PRD 同源校验齐备', () => {
    for (const f of model.features) {
      const html = htmlOf(f);
      assert.ok(!/<script\s+src=/.test(html), `${f.feature_id}: 存在外部 script 依赖`);
      assert.ok(!/<link\s[^>]*href="https?:/.test(html), `${f.feature_id}: 存在外部样式依赖`);
      assert.ok(html.includes('id="pageSel"') && html.includes('id="stateSel"') && html.includes('id="vpSel"'),
        `${f.feature_id}: 缺少页面 / 状态 / 视口切换器`);
      const active = f.prototype.pages.flatMap((p) => p.components.filter((c) => c.status !== 'DEPRECATED'));
      for (const c of active.filter((x) => x.type === 'button' && x.action)) {
        assert.ok(html.includes(`data-act-btn="${c.action}"`), `${f.feature_id}: 按钮 ${c.component_id} 缺少可执行动作`);
      }
      for (const c of active.filter((x) => x.props?.min !== undefined)) {
        assert.ok(html.includes(`data-min="${c.props.min}"`), `${f.feature_id}: ${c.component_id} 缺少来自 PRD 业务规则的 min 校验`);
      }
    }
  });

  test('一致性引擎包含 HTML 检查项且全部通过', async () => {
    const { engine } = ctx;
    const v = engine.validate(JSON.parse(fs.readFileSync(ctx.modelPath, 'utf8')), null, { checkFiles: true });
    assert.equal(v.failed, 0, `一致性失败: ${v.errors.slice(0, 3).map((e) => e.id).join(',')}`);
    const htmlChecks = v.checks.filter((c) => c.id.startsWith('V-FILE-PROTO-HTML-') || c.id.startsWith('V-HTML-PRD-LINK-'));
    assert.equal(htmlChecks.length, 112, '应有 56 存在性 + 56 对应性共 112 项 HTML 检查');
    assert.ok(htmlChecks.every((c) => c.result === 'PASS'));
  });
});

describe('HTML 原型 · 服务端安全路由', () => {
  test('HTML 原型可访问且 Content-Type 正确', async () => {
    const r = await fetch(`${base}/docs/product/prototypes/pay/UTER-PAY-001.html`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    const body = await r.text();
    assert.ok(body.includes('data-feature-id="UTER-PAY-001"'));
  });

  test('越界与类型防护：编码穿越 403、非 HTML 403、缺失 404、未命中前缀走 SPA', async () => {
    const enc = await fetch(`${base}/docs/product/prototypes/..%2fregistry/product-model.json`);
    assert.equal(enc.status, 403);
    const md = await fetch(`${base}/docs/product/prototypes/pay/UTER-PAY-001.md`);
    assert.equal(md.status, 403);
    const miss = await fetch(`${base}/docs/product/prototypes/pay/UTER-XXX-999.html`);
    assert.equal(miss.status, 404);
    const norm = await fetch(`${base}/docs/product/prototypes/../registry/product-model.json`);
    assert.equal(norm.status, 200);
    assert.match(await norm.text(), /<title>UTER 产品规格中心/, '规范化路径应落入 SPA fallback 而非泄露文件');
  });
});

describe('HTML 原型 · 真实浏览器交互（UTER-PAY-001）', () => {
  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/docs/product/prototypes/pay/UTER-PAY-001.html`);
    await page.waitForSelector('.pane-left');
  });

  test('左原型 / 右 PRD 双栏同屏，两侧 Feature 与 PRD 对应', async () => {
    assert.equal(await page.locator('.pane-left').count(), 1);
    assert.equal(await page.locator('.pane-right').count(), 1);
    const fid = await page.getAttribute('body', 'data-feature-id');
    assert.equal(fid, 'UTER-PAY-001');
    const prdPath = await page.getAttribute('body', 'data-prd-path');
    assert.equal(prdPath, 'docs/product/prd/pay/UTER-PAY-001.md');
    assert.ok(await page.locator('#prdPanel .req').count() >= 3);
  });

  test('表单校验规则与 PRD 业务规则同源（最低充值 10 元）', async () => {
    await page.fill('input[name="amount"]', '5');
    await page.click('button[data-act-btn="create_order"]');
    const alertText = await page.locator('[data-alert]:not([hidden])').first().innerText();
    assert.match(alertText, /充值金额不得低于 10 元/);
    const err = await page.locator('[data-err-for="amount"]').innerText();
    assert.match(err, /充值金额不得低于 10 元/);
  });

  test('合法金额触发 MOCK 弹窗，确认后关闭且不产生真实数据', async () => {
    await page.fill('input[name="amount"]', '30');
    await page.click('button[data-act-btn="create_order"]');
    const modal = page.locator('[data-modal="create_order"]');
    await page.waitForFunction(() => !document.querySelector('[data-modal="create_order"]').hidden);
    assert.ok(await modal.locator('text=MOCK').count() >= 1);
    await modal.locator('[data-mock-ok]').click();
    assert.ok(await page.evaluate(() => document.querySelector('[data-modal="create_order"]').hidden));
  });

  test('双向定位：左侧需求 chip 打开右侧对应需求块，右侧组件 ID 高亮左侧', async () => {
    const m = JSON.parse(fs.readFileSync(ctx.modelPath, 'utf8'));
    const f = m.features.find((x) => x.feature_id === 'UTER-PAY-001');
    const q = f.requirements.find((x) => x.requirement_id === 'REQ-PAY-001-01');
    const cid = q.component_ids[0];
    await page.locator('.cmp [data-loc-req="REQ-PAY-001-01"]').first().click();
    const opened = await page.evaluate((rid) => {
      const el = document.getElementById(`req-${rid}`);
      return { open: el.open, flashed: el.classList.contains('flash') };
    }, q.requirement_id);
    assert.ok(opened.open && opened.flashed, '右侧需求块应被打开并高亮');
    await page.locator(`#req-${q.requirement_id} [data-loc-cmp="${cid}"]`).click();
    const back = await page.evaluate((c) => {
      const el = document.querySelector(`.cmp[data-component-id="${c}"]`);
      return { visible: !el.closest('.page-sec').hidden, flashed: el.classList.contains('flash') };
    }, cid);
    assert.ok(back.visible && back.flashed, '左侧组件应回到视口并高亮');
  });

  test('状态切换与 PC/H5 视口切换生效', async () => {
    await page.selectOption('#stateSel', 'loading');
    assert.ok(await page.locator('#stateOverlay .skeleton').count() >= 2);
    assert.ok(await page.evaluate(() => document.querySelectorAll('.page-sec:not([hidden])').length === 0));
    await page.selectOption('#stateSel', 'idle');
    await page.selectOption('#vpSel', 'H5');
    assert.ok(await page.evaluate(() => document.getElementById('protoCanvas').classList.contains('h5')));
    await page.click('#resetBtn');
    assert.ok(await page.evaluate(() => !document.getElementById('protoCanvas').classList.contains('h5')));
  });
});
