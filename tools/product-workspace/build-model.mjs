/*
 * 统一产品需求模型构建器（一次性初始化 / 可重建基线，不覆盖已编辑的模型）
 *
 * 输入：tools/product-workspace/seed.mjs（真实代码盘点结论）
 * 输出：docs/product/registry/product-model.json —— 唯一权威需求数据源
 *
 * PRD、Prototype、注册表、报告全部是此模型的派生视图。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES, SCAN_META } from './seed.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const MODEL_PATH = path.join(ROOT, 'docs/product/registry/product-model.json');
export const HISTORY_DIR = path.join(ROOT, 'docs/product/history');

const base = (featureId) => featureId.replace(/^UTER-/, '');
const pad = (n) => String(n).padStart(2, '0');
export const IDS = {
  requirement: (f, n) => `REQ-${base(f)}-${pad(n)}`,
  page: (f, n) => `PP-${base(f)}-${pad(n)}`,
  interaction: (f, n) => `INT-${base(f)}-${pad(n)}`,
  component: (f, n) => `CMP-${base(f)}-${pad(n)}`,
  api: (f, n) => `API-${base(f)}-${pad(n)}`,
  dataModel: (f, n) => `DM-${base(f)}-${pad(n)}`,
  acceptance: (f, n) => `AC-${base(f)}-${pad(n)}`,
  testCase: (f, n) => `TC-${base(f)}-${pad(n)}`,
};

const DEMO_NOTICE = 'DEMO / MOCK：本原型只使用合成数据，不会发起真实支付、退款或余额变更。';

/* ── 原型页面模板：按业务形态生成可交互组件，而非静态截图 ───────────── */
function templateFor(kind, feature) {
  const isSensitive = ['PAY', 'REFUND', 'BALANCE', 'PLAN'].includes(feature.domain);
  switch (kind) {
    case 'payment':
      return {
        layout: 'two-column-form',
        components: [
          { type: 'badge', label: DEMO_NOTICE },
          { type: 'radio_group', label: '充值金额', name: 'amount_preset', options: ['10', '50', '100', '500'], props: { rule_field: 'amount' } },
          { type: 'input', label: '自定义金额', name: 'amount', inputType: 'number', required: true, props: { rule_field: 'min_amount', min: 10, error_message: '充值金额不得低于 10 元' } },
          { type: 'select', label: '支付方式', name: 'payment_method', options: ['微信支付', '支付宝', '易支付', 'Stripe'], props: {} },
          { type: 'button', label: isSensitive ? '创建 MOCK 订单' : '提交订单', action: 'create_order', props: {} },
          { type: 'alert', label: '金额校验错误提示', state: 'error', props: { rule_field: 'min_amount' } },
          { type: 'modal', label: '订单确认', trigger: 'create_order', props: {} },
        ],
        states: ['idle', 'loading', 'empty', 'error', 'success', 'disabled', 'permission_denied'],
        interactions: [
          { name: '选择预设金额', trigger: 'click:amount_preset', action: 'set_amount', targetPage: null },
          { name: '校验自定义金额', trigger: 'input:amount', action: 'validate_min_amount', targetPage: null },
          { name: '创建订单并跳转结果页', trigger: 'click:create_order', action: 'open_modal_then_navigate', targetPage: 1 },
          { name: '返回并恢复表单', trigger: 'click:back', action: 'restore_form_state', targetPage: 0 },
        ],
        secondPage: {
          name: '订单结果与状态', layout: 'result',
          components: [
            { type: 'badge', label: 'MOCK 订单 · 无真实资金变动' },
            { type: 'stat_card', label: '订单金额', name: 'order_amount', props: {} },
            { type: 'stat_card', label: '订单状态', name: 'order_status', props: {} },
            { type: 'button', label: '返回充值页', action: 'back', props: {} },
            { type: 'alert', label: '支付失败提示', state: 'error', props: {} },
          ],
          states: ['loading', 'success', 'error', 'empty'],
        },
      };
    case 'auth':
      return {
        layout: 'center-form',
        components: [
          { type: 'input', label: '邮箱', name: 'email', inputType: 'email', required: true, props: { error_message: '请输入有效邮箱' } },
          { type: 'input', label: '密码', name: 'password', inputType: 'password', required: true, props: { error_message: '密码不得为空' } },
          { type: 'button', label: '提交', action: 'submit', props: {} },
          { type: 'modal', label: '安全验证', trigger: 'submit', props: {} },
          { type: 'alert', label: '错误提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'error', 'success', 'disabled', 'permission_denied'],
        interactions: [
          { name: '表单校验', trigger: 'submit:form', action: 'validate_form', targetPage: null },
          { name: '打开安全验证弹窗', trigger: 'click:submit', action: 'open_modal', targetPage: null },
          { name: '成功后跳转控制台', trigger: 'success', action: 'navigate', targetPage: 1 },
        ],
        secondPage: {
          name: '登录后落地页', layout: 'result',
          components: [
            { type: 'badge', label: '登录成功（MOCK）' },
            { type: 'stat_card', label: '会话状态', name: 'session', props: {} },
            { type: 'button', label: '返回', action: 'back', props: {} },
          ],
          states: ['success', 'loading'],
        },
      };
    case 'list':
      return {
        layout: 'table-with-toolbar',
        components: [
          { type: 'search', label: '搜索', name: 'keyword', props: { placeholder: '输入关键字' } },
          { type: 'select', label: '状态筛选', name: 'status_filter', options: ['全部', '启用', '停用', '异常'], props: {} },
          { type: 'table', label: '数据列表', name: 'records', props: { columns: ['ID', '名称', '状态', '时间'] } },
          { type: 'pagination', label: '分页', name: 'page', props: { pageSize: 10 } },
          { type: 'button', label: '刷新', action: 'refresh', props: {} },
          { type: 'drawer', label: '详情抽屉', trigger: 'row_click', props: {} },
          { type: 'alert', label: '加载失败提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'empty', 'error', 'success', 'disabled', 'permission_denied'],
        interactions: [
          { name: '关键字搜索', trigger: 'input:keyword', action: 'filter_list', targetPage: null },
          { name: '状态筛选', trigger: 'change:status_filter', action: 'filter_list', targetPage: null },
          { name: '翻页', trigger: 'click:page', action: 'paginate', targetPage: null },
          { name: '打开详情抽屉', trigger: 'click:row', action: 'open_drawer', targetPage: null },
          { name: '查看详情页', trigger: 'click:detail', action: 'navigate', targetPage: 1 },
        ],
        secondPage: {
          name: '详情', layout: 'detail',
          components: [
            { type: 'tabs', label: '详情分组', name: 'tabs', options: ['基本信息', '关联记录', '变更历史'], props: {} },
            { type: 'timeline', label: '状态时间线', name: 'timeline', props: {} },
            { type: 'button', label: '返回列表', action: 'back', props: {} },
          ],
          states: ['loading', 'success', 'empty', 'error'],
        },
      };
    case 'dashboard':
      return {
        layout: 'stat-grid',
        components: [
          { type: 'select', label: '时间范围', name: 'range', options: ['今日', '近 7 天', '近 30 天'], props: {} },
          { type: 'stat_card', label: '核心指标 A', name: 'metric_a', props: {} },
          { type: 'stat_card', label: '核心指标 B', name: 'metric_b', props: {} },
          { type: 'stat_card', label: '核心指标 C', name: 'metric_c', props: {} },
          { type: 'progress', label: '用量进度', name: 'quota', props: { value: 62 } },
          { type: 'button', label: '刷新', action: 'refresh', props: {} },
          { type: 'alert', label: '加载失败提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'empty', 'error', 'success', 'permission_denied'],
        interactions: [
          { name: '切换时间范围', trigger: 'change:range', action: 'reload_stats', targetPage: null },
          { name: '刷新数据', trigger: 'click:refresh', action: 'reload_stats', targetPage: null },
          { name: '查看明细', trigger: 'click:metric', action: 'navigate', targetPage: 1 },
        ],
        secondPage: {
          name: '指标明细', layout: 'detail',
          components: [
            { type: 'table', label: '明细数据', name: 'detail_rows', props: { columns: ['时间', '维度', '数值'] } },
            { type: 'button', label: '返回', action: 'back', props: {} },
          ],
          states: ['loading', 'empty', 'success'],
        },
      };
    case 'settings':
      return {
        layout: 'settings-tabs',
        components: [
          { type: 'tabs', label: '配置分组', name: 'tabs', options: ['基础', '安全', '高级'], props: {} },
          { type: 'input', label: '配置项', name: 'config_value', required: true, props: { error_message: '配置值不合法' } },
          { type: 'toggle', label: '启用开关', name: 'enabled', props: {} },
          { type: 'button', label: '保存', action: 'save', props: {} },
          { type: 'modal', label: '保存确认', trigger: 'save', props: {} },
          { type: 'alert', label: '权限不足提示', state: 'permission_denied', props: {} },
        ],
        states: ['idle', 'loading', 'error', 'success', 'disabled', 'permission_denied'],
        interactions: [
          { name: '切换配置分组', trigger: 'click:tabs', action: 'switch_tab', targetPage: null },
          { name: '配置校验', trigger: 'submit:form', action: 'validate_form', targetPage: null },
          { name: '保存配置', trigger: 'click:save', action: 'open_modal_then_save', targetPage: null },
        ],
        secondPage: null,
      };
    case 'relay':
      return {
        layout: 'request-response',
        components: [
          { type: 'select', label: '模型', name: 'model', options: ['gpt-4o', 'claude-3-7', 'gemini-2.5'], props: {} },
          { type: 'textarea', label: 'Prompt', name: 'prompt', required: true, props: { error_message: 'Prompt 不得为空' } },
          { type: 'toggle', label: '流式输出', name: 'stream', props: {} },
          { type: 'button', label: '发送请求', action: 'send', props: {} },
          { type: 'code_block', label: '响应', name: 'response', props: {} },
          { type: 'alert', label: '超时 / 错误提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'error', 'success', 'disabled', 'permission_denied'],
        interactions: [
          { name: '模型选择', trigger: 'change:model', action: 'set_model', targetPage: null },
          { name: '发起请求', trigger: 'click:send', action: 'mock_relay', targetPage: null },
          { name: '失败重试', trigger: 'click:retry', action: 'retry', targetPage: null },
          { name: '查看请求日志', trigger: 'click:logs', action: 'navigate', targetPage: 1 },
        ],
        secondPage: {
          name: '请求日志', layout: 'detail',
          components: [
            { type: 'table', label: '请求记录', name: 'logs', props: { columns: ['时间', '模型', 'Token', '状态'] } },
            { type: 'button', label: '返回', action: 'back', props: {} },
          ],
          states: ['loading', 'empty', 'success'],
        },
      };
    case 'task':
      return {
        layout: 'task-console',
        components: [
          { type: 'input', label: '任务参数', name: 'task_input', required: true, props: { error_message: '任务参数不得为空' } },
          { type: 'button', label: '提交任务', action: 'submit_task', props: {} },
          { type: 'progress', label: '任务进度', name: 'progress', props: { value: 0 } },
          { type: 'table', label: '任务列表', name: 'tasks', props: { columns: ['任务 ID', '状态', '创建时间'] } },
          { type: 'button', label: '重试失败任务', action: 'retry', props: {} },
          { type: 'alert', label: '任务失败提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'empty', 'error', 'success', 'permission_denied'],
        interactions: [
          { name: '提交任务', trigger: 'click:submit_task', action: 'create_task', targetPage: null },
          { name: '轮询状态', trigger: 'timer', action: 'poll_status', targetPage: null },
          { name: '失败重试', trigger: 'click:retry', action: 'retry', targetPage: null },
          { name: '查看产物', trigger: 'click:artifact', action: 'navigate', targetPage: 1 },
        ],
        secondPage: {
          name: '任务产物', layout: 'detail',
          components: [
            { type: 'badge', label: 'MOCK 产物' },
            { type: 'code_block', label: '产物内容', name: 'artifact', props: {} },
            { type: 'button', label: '返回', action: 'back', props: {} },
          ],
          states: ['loading', 'empty', 'success'],
        },
      };
    case 'detail':
      return {
        layout: 'detail',
        components: [
          { type: 'tabs', label: '信息分组', name: 'tabs', options: ['概览', '关联', '历史'], props: {} },
          { type: 'timeline', label: '状态时间线', name: 'timeline', props: {} },
          { type: 'badge', label: '当前状态', name: 'status', props: {} },
          { type: 'button', label: '返回', action: 'back', props: {} },
          { type: 'alert', label: '加载失败提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'empty', 'error', 'success', 'permission_denied'],
        interactions: [
          { name: '切换分组', trigger: 'click:tabs', action: 'switch_tab', targetPage: null },
          { name: '返回', trigger: 'click:back', action: 'restore_form_state', targetPage: null },
        ],
        secondPage: null,
      };
    case 'form':
    default:
      return {
        layout: 'single-column-form',
        components: [
          { type: 'input', label: '输入项', name: 'field', required: true, props: { error_message: '该字段不得为空' } },
          { type: 'button', label: '提交', action: 'submit', props: {} },
          { type: 'modal', label: '结果确认', trigger: 'submit', props: {} },
          { type: 'alert', label: '错误提示', state: 'error', props: {} },
        ],
        states: ['idle', 'loading', 'error', 'success', 'disabled', 'permission_denied'],
        interactions: [
          { name: '表单校验', trigger: 'submit:form', action: 'validate_form', targetPage: null },
          { name: '提交并反馈', trigger: 'click:submit', action: 'open_modal_then_save', targetPage: null },
        ],
        secondPage: null,
      };
  }
}

function buildFeature(feature) {
  const f = feature.id;
  const tmpl = templateFor(feature.kind, feature);
  const isPlanned = ['NOT_IMPLEMENTED', 'UNKNOWN'].includes(feature.status);
  const now = SCAN_META.scanned_at + 'T00:00:00+08:00';

  const requirements = feature.reqs.map((rq, i) => {
    const rid = IDS.requirement(f, i + 1);
    const rules = (rq.rules || []).map((text, j) => ({
      rule_id: `BR-${base(f)}-${pad(i + 1)}-${pad(j + 1)}`,
      requirement_id: rid,
      text,
      value: rq.rule_field && j === 0 ? rq.rule_value : null,
      field: rq.rule_field || null,
      status: text.includes('NEEDS_') ? 'NEEDS_PRODUCT_DECISION' : 'ACTIVE',
    }));
    const input = rq.input || null;
    return {
      requirement_id: rid,
      feature_id: f,
      title: rq.t,
      description: rq.d,
      priority: feature.priority,
      status: rq.d.includes('【规划】') || rq.d.includes('【待确认】') ? 'PLANNED' : 'ACTIVE',
      entry: feature.pages[0] || null,
      inputs: input ? [{ name: input.name, type: input.type, required: !!input.required, validation: rules.map((x) => x.text) }] : [],
      output: rq.output || '操作结果与状态反馈',
      business_rules: rules,
      permission: feature.roles.join(', '),
      data_change: `${f} 相关业务数据按规则变更（MOCK 原型不写真实数据）`,
      error_messages: rules.filter((x) => /不得|必须|错误|拒绝|限制|不合法/.test(x.text)).map((x) => x.text),
      acceptance_ids: [],
      test_case_ids: [],
      prototype_page_ids: [],
      component_ids: [],
      interaction_ids: [],
      change_ids: [],
    };
  });

  // 原型页面
  const pages = [];
  const mainComponents = tmpl.components.map((c, i) => ({
    component_id: IDS.component(f, i + 1),
    type: c.type,
    label: c.label,
    name: c.name || null,
    input_type: c.inputType || null,
    required: !!c.required,
    options: c.options || [],
    action: c.action || null,
    trigger: c.trigger || null,
    state: c.state || null,
    props: { ...(c.props || {}) },
    requirement_id: requirements[0]?.requirement_id || null,
    interaction_ids: [],
    status: 'ACTIVE',
  }));
  // 把带校验规则的需求绑定到金额/输入组件
  const amountComp = mainComponents.find((c) => c.props?.rule_field === 'min_amount');
  const amountReq = requirements.find((q) => q.business_rules.some((b) => b.field === 'min_amount'));
  if (amountComp && amountReq) amountComp.requirement_id = amountReq.requirement_id;

  const mainInteractions = tmpl.interactions.map((it, i) => ({
    interaction_id: IDS.interaction(f, i + 1),
    name: it.name,
    trigger: it.trigger,
    action: it.action,
    target_page_id: it.targetPage === 1 ? IDS.page(f, 2) : null,
    requirement_id: requirements[Math.min(i, requirements.length - 1)]?.requirement_id || null,
    steps: [it.trigger, it.action],
    status: 'ACTIVE',
  }));

  pages.push({
    prototype_page_id: IDS.page(f, 1),
    feature_id: f,
    name: `${feature.name} · 主页面`,
    entry: feature.pages[0] || `（未发现对应前端页面：${feature.status}）`,
    layout: tmpl.layout,
    status: isPlanned ? 'PLANNED' : 'ACTIVE',
    planned: isPlanned,
    planned_notice: isPlanned ? '规划原型：不代表已上线功能，禁止作为已实现证据。' : null,
    demo_notice: DEMO_NOTICE,
    requirement_ids: requirements.map((q) => q.requirement_id),
    components: mainComponents,
    interactions: mainInteractions,
    states: tmpl.states.map((s, i) => ({
      state_id: `ST-${base(f)}-${pad(1)}-${pad(i + 1)}`,
      name: s,
      kind: s,
      description: `${s} 状态：按 UDS 8.0.0 展示加载 / 空 / 错误 / 成功 / 禁用 / 权限不足反馈。`,
    })),
  });

  if (tmpl.secondPage) {
    const s = tmpl.secondPage;
    pages.push({
      prototype_page_id: IDS.page(f, 2),
      feature_id: f,
      name: `${feature.name} · ${s.name}`,
      entry: `由 ${IDS.page(f, 1)} 的页面跳转进入`,
      layout: s.layout,
      status: isPlanned ? 'PLANNED' : 'ACTIVE',
      planned: isPlanned,
      planned_notice: isPlanned ? '规划原型：不代表已上线功能。' : null,
      demo_notice: DEMO_NOTICE,
      requirement_ids: requirements.slice(0, 1).map((q) => q.requirement_id),
      components: s.components.map((c, i) => ({
        component_id: IDS.component(f, 100 + i + 1),
        type: c.type, label: c.label, name: c.name || null,
        input_type: c.inputType || null, required: !!c.required,
        options: c.options || [], action: c.action || null, trigger: c.trigger || null,
        state: c.state || null, props: { ...(c.props || {}) },
        requirement_id: requirements[0]?.requirement_id || null,
        interaction_ids: [], status: 'ACTIVE',
      })),
      interactions: [{
        interaction_id: IDS.interaction(f, 100),
        name: '返回主页面并恢复状态',
        trigger: 'click:back', action: 'restore_form_state',
        target_page_id: IDS.page(f, 1),
        requirement_id: requirements[0]?.requirement_id || null,
        steps: ['click:back', 'restore_form_state'], status: 'ACTIVE',
      }],
      states: s.states.map((x, i) => ({
        state_id: `ST-${base(f)}-${pad(2)}-${pad(i + 1)}`,
        name: x, kind: x, description: `${x} 状态。`,
      })),
    });
  }

  // 验收标准（Given / When / Then）
  const acceptance = [];
  requirements.forEach((q, i) => {
    const items = [
      {
        type: 'normal',
        given: `用户具有 ${feature.roles.join(' / ')} 角色且已进入 ${pages[0].name}`,
        when: `执行「${q.title}」的正常操作`,
        then: `系统返回成功结果，且原型 ${pages[0].prototype_page_id} 可复现相同行为`,
      },
      {
        type: 'exception',
        given: '输入不满足业务规则或上游返回错误',
        when: `执行「${q.title}」并触发校验失败`,
        then: `展示明确错误提示，不写入真实数据，原型错误状态可见`,
      },
      {
        type: 'permission',
        given: '当前用户不具备该功能所需角色',
        when: '访问该功能入口',
        then: '展示权限不足状态或 403，不泄露受保护数据',
      },
    ];
    if (q.business_rules.some((b) => b.field === 'min_amount')) {
      const v = q.business_rules.find((b) => b.field === 'min_amount')?.value;
      items.push({
        type: 'boundary',
        given: `系统最低充值金额为 ${v} 元`,
        when: `输入 ${v - 1} 元并提交`,
        then: `校验失败并提示「不得低于 ${v} 元」；输入 ${v} 元时校验通过`,
      });
    }
    items.forEach((it, j) => {
      const id = IDS.acceptance(f, acceptance.length + 1);
      acceptance.push({ acceptance_id: id, feature_id: f, requirement_id: q.requirement_id, ...it, prototype_page_id: pages[0].prototype_page_id });
      q.acceptance_ids.push(id);
    });
  });

  // 测试用例：映射到真实可执行的需求追溯测试套件
  const tests = [];
  requirements.forEach((q) => {
    const id = IDS.testCase(f, tests.length + 1);
    tests.push({
      test_case_id: id,
      feature_id: f,
      requirement_id: q.requirement_id,
      acceptance_ids: [...q.acceptance_ids],
      name: `${q.requirement_id} 需求-原型-验收-测试追溯`,
      path: 'tools/product-workspace/tests/requirements-trace.test.mjs',
      kind: 'automated',
      status: 'ACTIVE',
      result: 'NOT_RUN',
      code_evidence: feature.tests || [],
    });
    q.test_case_ids.push(id);
  });

  // 关联 ID
  const apis = (feature.apis || []).map((a, i) => {
    const [method, p] = a.split(' ');
    return { api_id: IDS.api(f, i + 1), feature_id: f, method: method || 'GET', path: p || a, source: 'router/*.go', request: '按实际接口定义', response: '按实际接口定义', errors: ['401', '403', '4xx/5xx 业务错误'] };
  });
  const dataModels = (feature.models || []).map((m, i) => ({
    data_model_id: IDS.dataModel(f, i + 1), feature_id: f, name: path.basename(m), source: m, fields: [],
  }));

  requirements.forEach((q) => {
    q.prototype_page_ids = [pages[0].prototype_page_id];
    q.component_ids = mainComponents.filter((c) => c.requirement_id === q.requirement_id).map((c) => c.component_id);
    q.interaction_ids = mainInteractions.filter((it) => it.requirement_id === q.requirement_id).map((it) => it.interaction_id);
  });
  mainComponents.forEach((c) => {
    c.interaction_ids = mainInteractions.filter((it) => it.action?.includes(c.action || '###') || it.trigger?.includes(c.name || '###')).map((it) => it.interaction_id);
  });

  const prdPath = `docs/product/prd/${feature.domain.toLowerCase()}/${f}.md`;
  return {
    feature_id: f,
    name: feature.name,
    domain: feature.domain,
    module: feature.domain.toLowerCase(),
    status: feature.status,
    priority: feature.priority,
    roles: feature.roles,
    kind: feature.kind,
    evidence_note: feature.evidence_note || null,
    status_note: feature.note || null,
    open_decisions: feature.open_decisions || [],
    background: {
      goal: feature.goal,
      problem: feature.problem,
      scenarios: feature.scenarios || [],
      boundaries: feature.boundaries || [],
      related: [],
    },
    user_stories: (feature.stories || []).map(([role, action, goal]) => ({ role, action, goal, text: `作为${role}，我希望${action}，从而${goal}。` })),
    scope: {
      included: feature.scenarios || [],
      excluded: feature.boundaries || [],
      upstream: feature.apis?.slice(0, 2) || [],
      downstream: feature.models?.slice(0, 2) || [],
    },
    flows: {
      normal: [`进入 ${pages[0].name}`, '填写/选择必要输入', '提交并校验', '展示成功结果与状态'],
      exception: ['输入校验失败并提示', '上游错误时展示错误状态', '权限不足时展示 403 / 权限状态'],
      boundary: ['空数据展示空状态', '加载中展示骨架/禁用态', '重复提交被拦截'],
      states: tmpl.states,
      recovery: ['失败后可重试', '返回时恢复表单状态', '变更可从历史版本恢复'],
      permissions: [`仅 ${feature.roles.join(' / ')} 可访问`, '前后端双重权限校验'],
    },
    requirements,
    prototype: {
      prototype_id: `PROTO-${base(f)}`,
      primary_page_id: pages[0].prototype_page_id,
      pages,
      viewport_default: 'PC',
    },
    apis,
    data_models: dataModels,
    acceptance,
    tests,
    evidence: {
      pages: feature.pages || [],
      apis: feature.apis || [],
      code: feature.code || [],
      models: feature.models || [],
      tests: feature.tests || [],
      note: feature.evidence_note || null,
    },
    prd: {
      prd_id: `PRD-${base(f)}`,
      feature_id: f,
      version: 1,
      path: prdPath,
      status: isPlanned ? 'PLANNED' : 'ACTIVE',
      created_at: now,
      updated_at: now,
      sections: [
        '基础信息', '产品背景', '用户角色', '用户故事', '功能范围', '业务流程',
        '功能需求', '页面交互', 'API 和数据模型', '验收标准', '测试追溯', '版本变更',
      ],
    },
    mapping: {
      requirement_to_page: Object.fromEntries(requirements.map((q) => [q.requirement_id, q.prototype_page_ids])),
      page_to_prd: Object.fromEntries(pages.map((p) => [p.prototype_page_id, prdPath])),
    },
    versions: { prd: 1, prototype: 1 },
    sync_status: 'SYNCED',
    last_synced_at: now,
    last_change_source: 'INITIAL_SCAN',
    audit_trail: [],
    updated_at: now,
  };
}

export function buildModel() {
  const features = FEATURES.map(buildFeature);
  const mappings = [];
  features.forEach((f) => {
    f.requirements.forEach((q) => {
      mappings.push({
        feature_id: f.feature_id,
        requirement_id: q.requirement_id,
        prd_path: f.prd.path,
        prototype_page_id: q.prototype_page_ids[0] || null,
        prototype_path: `docs/product/prototypes/${f.domain.toLowerCase()}/${f.feature_id}.md`,
        interaction_ids: q.interaction_ids,
        component_ids: q.component_ids,
        api_ids: f.apis.map((a) => a.api_id),
        data_model_ids: f.data_models.map((d) => d.data_model_id),
        acceptance_ids: q.acceptance_ids,
        test_case_ids: q.test_case_ids,
        version: 1,
        sync_status: 'SYNCED',
      });
    });
  });

  const model = {
    schema_version: '1.0.0',
    model_id: 'UTER-PRODUCT-MODEL',
    model_version: 1,
    source_of_truth: MODEL_PATH.replace(ROOT + '/', ''),
    created_at: SCAN_META.scanned_at + 'T00:00:00+08:00',
    updated_at: SCAN_META.scanned_at + 'T00:00:00+08:00',
    design_system: SCAN_META.design_system,
    scan: SCAN_META,
    standards: {
      feature_id: 'UTER-{DOMAIN}-{NUMBER}',
      requirement_id: 'REQ-{DOMAIN-NUMBER}-{NN}',
      prototype_page_id: 'PP-{DOMAIN-NUMBER}-{NN}',
      interaction_id: 'INT-{DOMAIN-NUMBER}-{NN}',
      component_id: 'CMP-{DOMAIN-NUMBER}-{NN}',
      api_id: 'API-{DOMAIN-NUMBER}-{NN}',
      data_model_id: 'DM-{DOMAIN-NUMBER}-{NN}',
      acceptance_id: 'AC-{DOMAIN-NUMBER}-{NN}',
      test_case_id: 'TC-{DOMAIN-NUMBER}-{NN}',
      change_id: 'CHG-{TIMESTAMP}-{SEQ}',
    },
    features,
    mappings,
    changes: [{
      change_id: 'CHG-INIT-0001',
      feature_id: 'ALL',
      source_view: 'System Generated',
      source_type: 'INITIAL_BASELINE',
      op: 'initial_scan',
      base_version: 0,
      target_version: 1,
      changed_fields: ['features', 'mappings'],
      impact_scope: { requirements: features.reduce((n, f) => n + f.requirements.length, 0), pages: features.reduce((n, f) => n + f.prototype.pages.length, 0) },
      sync_status: 'SYNCED',
      reason: '基于真实代码盘点建立统一需求模型',
      actor: 'WorkBuddy',
      created_at: SCAN_META.scanned_at + 'T00:00:00+08:00',
      sync_events: [],
    }],
    conflicts: [],
    snapshots: [{ version: 1, created_at: SCAN_META.scanned_at + 'T00:00:00+08:00', reason: '初始基线', change_id: 'CHG-INIT-0001' }],
    feature_id_tombstones: [],
    sync_metrics: { prd_to_prototype_success: 0, prototype_to_prd_success: 0, sync_loops: 0, silent_overwrites: 0, failed: 0 },
  };
  return model;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const force = process.argv.includes('--force');
  if (fs.existsSync(MODEL_PATH) && !force) {
    console.error(`[build-model] 已存在 ${MODEL_PATH}，拒绝覆盖已编辑的统一数据源。使用 --force 才会重建基线。`);
    process.exit(2);
  }
  const model = buildModel();
  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true });
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(model, null, 2) + '\n');
  fs.writeFileSync(path.join(HISTORY_DIR, 'v1.json'), JSON.stringify(model, null, 2) + '\n');
  console.log(`[build-model] 写入 ${MODEL_PATH}`);
  console.log(`[build-model] features=${model.features.length} requirements=${model.features.reduce((n, f) => n + f.requirements.length, 0)} pages=${model.features.reduce((n, f) => n + f.prototype.pages.length, 0)} mappings=${model.mappings.length}`);
}
