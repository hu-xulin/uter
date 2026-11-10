/*
 * 自动化测试 · 真实浏览器端到端（Playwright + Chromium）
 * 覆盖产品规格中心双栏布局、拖动分隔线、PC/H5、独立/全屏、双向定位、
 * Feature 切换同步、PRD→Prototype 与 Prototype→PRD 可视化编辑、业务规则同步、
 * 一致性检查、只读权限、冲突与历史恢复。服务与模型均为隔离副本。
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, loadServer } from './helpers.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, 'web/node_modules/playwright'));

let ctx, srv, base, browser, page;
const model = () => JSON.parse(fs.readFileSync(ctx.modelPath, 'utf8'));
const waitText = (sel, text, timeout = 10000) => page.waitForFunction(
  ({ sel, text }) => document.querySelector(sel)?.textContent.includes(text), { sel, text }, { timeout },
);
const openDetail = async () => {
  await page.click('#viewnav button[data-view="detail"]');
  await page.waitForSelector('#split');
};
const submitDialog = async () => {
  await page.click('#dlgForm button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('#dialogRoot .dialog'), null, { timeout: 15000 });
};

before(async () => {
  ctx = await loadServer();
  srv = ctx.server.createServer();
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${srv.address().port}`;
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/?feature=UTER-PAY-001`);
  await page.waitForSelector('#viewnav button');
  await waitText('#statusbar', 'UTER-PAY-001');
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => srv.close(resolve));
  ctx.cleanup();
});

describe('产品规格中心 · 双栏与视口', () => {
  test('SPA 正常加载，8 个视图入口与状态栏可见', async () => {
    assert.equal(await page.locator('#viewnav button').count(), 8);
    assert.match(await page.locator('#statusbar').innerText(), /56 个功能/);
    assert.match(await page.locator('#statusbar').innerText(), /Model v1/);
    assert.ok(!(await page.locator('#main').innerText()).includes('无法加载统一需求模型'));
  });

  test('左侧 Prototype / 右侧 PRD，默认 50/50 且各自独立滚动', async () => {
    await openDetail();
    assert.equal(await page.locator('#paneLeft').count(), 1);
    assert.equal(await page.locator('#paneRight').count(), 1);
    assert.equal(await page.locator('#divider').count(), 1);
    assert.equal(await page.locator('#split').evaluate((el) => el.style.getPropertyValue('--split')), '50');
    // 真正的滚动容器是 .pane（.pane-body 只是内容承载层），并且要用实际 scrollTop 验证「独立」。
    const overflow = await page.locator('#paneLeft').evaluate((el) => getComputedStyle(el).overflowY);
    assert.ok(['auto', 'scroll'].includes(overflow), `左侧未独立滚动: ${overflow}`);
    const overflowR = await page.locator('#paneRight').evaluate((el) => getComputedStyle(el).overflowY);
    assert.ok(['auto', 'scroll'].includes(overflowR), `右侧未独立滚动: ${overflowR}`);
    const scrollResult = await page.evaluate(() => {
      const L = document.querySelector('#paneLeft');
      const R = document.querySelector('#paneRight');
      const start = { left: L.scrollTop, right: R.scrollTop };
      const out = [];
      for (const [key, el, other] of [['left', L, R], ['right', R, L]]) {
        const scrollable = el.scrollHeight > el.clientHeight + 4;
        if (!scrollable) { out.push({ view: key, scrollable: false }); continue; }
        const otherBefore = other.scrollTop;
        el.scrollTop = 240;
        out.push({ view: key, scrollable: true, moved: el.scrollTop, otherBefore, otherAfter: other.scrollTop });
        el.scrollTop = start[key];
      }
      return out;
    });
    assert.ok(scrollResult.some((r) => r.scrollable), '两侧均无滚动内容，无法验证独立滚动');
    for (const r of scrollResult.filter((x) => x.scrollable)) {
      assert.ok(r.moved > 0, `${r.view} 未能滚动`);
      assert.equal(r.otherAfter, r.otherBefore, `滚动 ${r.view} 时另一侧被带动，双栏未独立`);
    }
    assert.match(await page.locator('#paneLeft').innerText(), /PP-PAY-001-01/);
    assert.match(await page.locator('#paneRight').innerText(), /基础信息|产品背景/);
  });

  test('拖动分隔线改变比例，恢复默认回到 50/50', async () => {
    const box = await page.locator('#divider').boundingBox();
    const splitBox = await page.locator('#split').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(splitBox.x + splitBox.width * 0.68, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const dragged = await page.locator('#split').evaluate((el) => Number(el.style.getPropertyValue('--split')));
    assert.ok(dragged >= 60 && dragged <= 75, `拖动未生效: ${dragged}`);
    await page.click('[data-act="reset-layout"]');
    assert.equal(await page.locator('#split').evaluate((el) => el.style.getPropertyValue('--split')), '50');
  });

  test('PC / H5 视口切换与全屏预览', async () => {
    await page.click('[data-act="viewport"][data-v="H5"]');
    assert.ok(await page.locator('#protoCanvas').evaluate((el) => el.classList.contains('h5')));
    await page.click('[data-act="viewport"][data-v="PC"]');
    assert.ok(!(await page.locator('#protoCanvas').evaluate((el) => el.classList.contains('h5'))));
    await page.click('[data-act="fullscreen-proto"]');
    await page.waitForSelector('#split.prototype-fullscreen');
    await page.click('[data-act="reset-layout"]');
    await page.waitForSelector('#split:not(.prototype-fullscreen)');
  });

  test('页面状态（加载 / 空 / 错误 / 成功 / 禁用 / 权限不足）可切换', async () => {
    const kinds = await page.locator('.state-switcher button').evaluateAll((els) => els.map((e) => e.dataset.state));
    for (const k of ['loading', 'empty', 'error', 'success', 'disabled', 'permission_denied']) {
      assert.ok(kinds.includes(k), `缺少状态 ${k}`);
    }
    await page.click('.state-switcher button[data-state="error"]');
    assert.ok(await page.locator('.state-switcher button[data-state="error"]').evaluate((el) => el.classList.contains('active')));
    await page.click('.state-switcher button[data-state="idle"]');
  });
});

describe('双向定位与 Feature 同步', () => {
  test('PRD 点击组件 ID 可在左侧原型高亮定位', async () => {
    const chip = page.locator('#paneRight [data-act="locate-proto"][data-cmp]').first();
    const cmp = await chip.getAttribute('data-cmp');
    await chip.click();
    await page.waitForSelector(`#cmp-${cmp}.highlight`, { timeout: 8000 });
  });

  test('Prototype 点击 Requirement ID 可在右侧 PRD 高亮定位', async () => {
    const chip = page.locator('#paneLeft [data-act="locate-prd"][data-req]').first();
    const req = await chip.getAttribute('data-req');
    await chip.click();
    await page.waitForSelector(`#req-${req}.highlight`, { timeout: 8000 });
  });

  test('切换 Feature 时左右两侧依据映射同步重新加载', async () => {
    await page.click('#viewnav button[data-view="catalog"]');
    await page.fill('#catSearch', 'UTER-AUTH-001');
    await page.click('[data-act="cat-search"]');
    await page.click('button[data-act="open-feature"][data-id="UTER-AUTH-001"]');
    await page.waitForSelector('#split');
    assert.match(await page.locator('#paneLeft').innerText(), /PP-AUTH-001-01/);
    assert.match(await page.locator('#paneRight').innerText(), /邮箱密码登录/);
    assert.match(await page.locator('#statusbar').innerText(), /UTER-AUTH-001/);
    // 回到充值功能，供后续编辑测试使用
    await page.click('#viewnav button[data-view="catalog"]');
    await page.fill('#catSearch', 'UTER-PAY-001');
    await page.click('[data-act="cat-search"]');
    await page.click('button[data-act="open-feature"][data-id="UTER-PAY-001"]');
    await page.waitForSelector('#split');
    assert.match(await page.locator('#paneLeft').innerText(), /PP-PAY-001-01/);
  });
});

describe('可视化双向同步编辑', () => {
  test('场景二：PRD 新增自定义充值金额需求 → 左侧原型自动出现组件', async () => {
    const before = model().features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length;
    await page.click('#paneRight [data-act="add-requirement"]');
    await page.waitForSelector('#dlgForm [name="title"]');
    await page.fill('#dlgForm [name="title"]', 'E2E 自定义充值金额');
    await page.fill('#dlgForm [name="description"]', 'E2E：允许用户填写自定义充值金额并按最低金额校验。');
    await page.fill('#dlgForm [name="input_name"]', 'e2e_custom_amount');
    await page.fill('#dlgForm [name="rule_value"]', '20');
    await submitDialog();
    await waitText('#paneLeft', 'E2E 自定义充值金额');
    await waitText('#paneRight', 'E2E 自定义充值金额');
    const m = model();
    assert.equal(m.features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length, before + 1);
    assert.ok(m.changes.at(-1).sync_events.some((e) => e.origin === 'SYSTEM_GENERATED'));
  });

  test('场景三：Prototype 新增充值方式选择组件 → 右侧 PRD 自动新增需求', async () => {
    await page.click('#paneLeft [data-act="add-component"]');
    await page.waitForSelector('#dlgForm [name="label"]');
    await page.fill('#dlgForm [name="label"]', 'E2E 充值方式选择');
    await page.fill('#dlgForm [name="name"]', 'e2e_payment_channel');
    await submitDialog();
    await waitText('#paneRight', 'E2E 充值方式选择');
    await waitText('#paneLeft', 'E2E 充值方式选择');
    const f = model().features.find((x) => x.feature_id === 'UTER-PAY-001');
    const q = f.requirements.find((x) => x.title.includes('E2E 充值方式选择'));
    assert.ok(q, 'PRD 未自动新增需求');
    assert.equal(q.business_rules[0].status, 'NEEDS_PRODUCT_DECISION', '不确定业务语义未标记待产品决策');
  });

  test('场景四：修改业务规则同步原型校验、错误提示与验收标准', async () => {
    const ruleId = model().features.find((f) => f.feature_id === 'UTER-PAY-001')
      .requirements.flatMap((q) => q.business_rules).find((b) => b.field === 'min_amount').rule_id;
    await page.click(`#paneRight [data-act="edit-rule"][data-id="${ruleId}"]`);
    await page.waitForSelector('#dlgForm [name="value"]');
    await page.fill('#dlgForm [name="value"]', '30');
    await page.fill('#dlgForm [name="text"]', '最低充值金额不得低于 30 元');
    await submitDialog();
    await page.waitForFunction(() => document.querySelector('#statusbar')?.textContent.includes('Model v'), null, { timeout: 10000 });
    const f = model().features.find((x) => x.feature_id === 'UTER-PAY-001');
    const rule = f.requirements.flatMap((q) => q.business_rules).find((b) => b.rule_id === ruleId);
    assert.equal(rule.value, 30);
    const input = f.prototype.pages.flatMap((p) => p.components).find((c) => c.component_id === 'CMP-PAY-001-03');
    assert.equal(input.props.min, 30);
    assert.match(input.props.error_message, /30/);
    assert.ok(f.acceptance.some((a) => a.type === 'boundary' && a.given.includes('30')));
  });

  test('一致性检查按钮返回 PASS 且无失败项', async () => {
    await page.click('#viewnav button[data-view="coverage"]');
    await page.click('[data-act="run-validation"]');
    await page.waitForFunction(() => window.__validation && window.__validation.total > 0, null, { timeout: 10000 });
    const v = await page.evaluate(() => window.__validation);
    assert.equal(v.failed, 0, JSON.stringify(v.errors?.slice(0, 3)));
    assert.ok(v.total >= 1000);
  });

  test('普通用户只读：编辑按钮被拒绝且不修改模型', async () => {
    const before = model().model_version;
    await page.selectOption('#roleSelect', 'viewer');
    await page.click('#viewnav button[data-view="detail"]');
    await page.click('#paneRight [data-act="add-requirement"]');
    await waitText('#toast', '只读');
    assert.equal(await page.locator('#dialogRoot .dialog').count(), 0);
    await page.selectOption('#roleSelect', 'admin');
    assert.equal(model().model_version, before);
  });
});

describe('冲突处理与历史恢复（UI）', () => {
  test('模拟并发冲突后进入待处理，并可保留先提交一侧解决', async () => {
    await page.click('#viewnav button[data-view="changes"]');
    await page.click('[data-act="simulate-conflict"]');
    await page.waitForFunction(() => document.querySelector('#main')?.textContent.includes('CONFLICT'), null, { timeout: 15000 });
    const m = model();
    const open = m.conflicts.find((c) => c.status === 'OPEN');
    assert.ok(open, '未产生待处理冲突');
    assert.equal(open.requires_product_decision, true);
    await page.click(`[data-act="resolve-conflict"][data-id="${open.conflict_id}"][data-choice="prior"]`);
    await page.waitForFunction((cid) => !document.querySelector('#main')?.textContent.includes(cid) || document.querySelector('#statusbar')?.textContent.includes('SYNCED'), open.conflict_id, { timeout: 15000 });
    assert.equal(model().conflicts.find((c) => c.conflict_id === open.conflict_id).status, 'RESOLVED');
  });

  test('历史恢复生成新版本且保留恢复前变更记录', async () => {
    const before = model();
    await page.click('[data-act="restore-version"][data-version="1"]');
    await page.waitForSelector('#dlgForm [name="reason"]');
    await page.fill('#dlgForm [name="reason"]', 'E2E 恢复初始基线');
    await submitDialog();
    await page.waitForFunction((v) => Number(document.querySelector('#statusbar')?.textContent.match(/Model v(\d+)/)?.[1]) > v, before.model_version, { timeout: 15000 });
    const after = model();
    assert.ok(after.model_version > before.model_version);
    assert.ok(after.changes.length > before.changes.length, '恢复覆盖了历史变更');
    assert.ok(after.changes.some((c) => c.source_type === 'RESTORE'));
    assert.equal(after.features.find((f) => f.feature_id === 'UTER-PAY-001').requirements.length, 3);
  });
});
