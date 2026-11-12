import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_DIR } from './schema-paths.mjs';

const statuses = ['NOT_BUILT', 'PARTIALLY_BUILT', 'IMPLEMENTED_NOT_VERIFIED', 'PARTIALLY_VERIFIED', 'FULLY_VERIFIED', 'FULLY_OPERATIONAL', 'BLOCKED', 'FAILED'];
const taskStates = ['CREATED', 'QUEUED', 'RUNNING', 'PAUSED', 'WAITING_RECOVERY', 'BLOCKED', 'FAILED', 'SUCCEEDED', 'CANCELLED'];

const schemas = {
  'task.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/task', title: 'UAP Task',
    type: 'object', required: ['task_id', 'objective', 'scope', 'specification_ids', 'constraints', 'acceptance_criteria', 'state', 'steps', 'trace_id'],
    properties: {
      task_id: { type: 'string', pattern: '^UAP-TASK-' }, objective: { type: 'string', minLength: 1 },
      scope: { type: 'string' }, specification_ids: { type: 'array', items: { type: 'string', pattern: '^UAP-\\d\\d-\\d\\d\\d$' } },
      constraints: { type: 'array', items: { type: 'string' } }, acceptance_criteria: { type: 'array', items: { type: 'string' }, minItems: 1 },
      dependencies: { type: 'array', items: { type: 'string' } }, permissions: { type: 'array', items: { type: 'string' } },
      agent_id: { type: 'string' }, state: { enum: taskStates }, trace_id: { type: 'string' },
      context_version: { type: 'string' }, max_retries: { type: 'integer', minimum: 0, maximum: 2 },
      created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
      steps: { type: 'array', items: { $ref: '#/$defs/step' } },
      side_effects: { type: 'array', items: { type: 'object' } },
      evidence_refs: { type: 'array', items: { type: 'string' } }, changed_files: { type: 'array', items: { type: 'string' } },
      validation_results: { type: 'array', items: { $ref: 'validator-result.schema.json' } },
      history: { type: 'array', items: { type: 'object', required: ['from', 'to', 'at'], properties: { from: { enum: taskStates }, to: { enum: taskStates }, at: { type: 'string' }, reason: { type: 'string' } } } },
      blocked_reasons: { type: 'array', items: { type: 'string' } }, error: { type: ['string', 'null'] },
    },
    $defs: {
      step: {
        type: 'object', required: ['step_id', 'name', 'status', 'attempts', 'evidence_refs'],
        properties: {
          step_id: { type: 'string' }, name: { type: 'string' }, handler: { type: 'string' }, idempotent: { type: 'boolean' },
          status: { enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'BLOCKED'] }, attempts: { type: 'integer', minimum: 0 },
          evidence_refs: { type: 'array', items: { type: 'string' } }, changed_files: { type: 'array', items: { type: 'string' } },
          outputs: { type: 'object' }, error: { type: ['string', 'null'] },
        },
      },
    },
  },
  'agent-result.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/agent-result', title: 'UAP Agent Result',
    type: 'object', required: ['status', 'summary', 'changed_files', 'evidence_refs', 'agent_id'],
    properties: {
      agent_id: { type: 'string' }, role: { type: 'string' }, status: { enum: ['SUCCEEDED', 'FAILED', 'BLOCKED'] },
      summary: { type: 'string' }, changed_files: { type: 'array', items: { type: 'string' } },
      commands: { type: 'array', items: { type: 'string' } }, evidence_refs: { type: 'array', items: { type: 'string' } },
      outputs: { type: 'object' },
    },
  },
  'executor-result.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/executor-result', title: 'UAP Executor Result',
    type: 'object', required: ['result_id', 'task_id', 'executor_id', 'status', 'summary', 'changed_files', 'validation_results', 'evidence_refs', 'blocked_reasons'],
    properties: {
      result_id: { type: 'string' }, task_id: { type: ['string', 'null'] }, executor_id: { type: 'string' },
      status: { type: 'string' }, summary: { type: 'string' }, changed_files: { type: 'array', items: { type: 'string' } },
      commands: { type: 'array', items: { type: 'string' } }, evidence_refs: { type: 'array', items: { type: 'string' } },
      blocked_reasons: { type: 'array', items: { type: 'string' } }, outputs: { type: 'object' },
      validation_results: { type: 'array', maxItems: 0, description: 'Executor must not self-declare validation; this array is always empty on an executor result.' },
      completed_at: { type: 'string', format: 'date-time' },
    },
  },
  'validator-result.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/validator-result', title: 'UAP Validator Result',
    type: 'object', required: ['validator_id', 'status', 'executed', 'exit_code', 'checked_at', 'evidence_refs', 'findings', 'summary'],
    properties: {
      validator_id: { type: 'string' }, status: { enum: ['PASS', 'FAIL', 'BLOCKED', 'NOT_EXECUTED'] },
      executed: { type: 'boolean' }, exit_code: { type: ['integer', 'null'] }, checked_at: { type: 'string', format: 'date-time' },
      evidence_refs: { type: 'array', items: { type: 'string' } },
      findings: { type: 'array', items: { type: 'object', required: ['severity', 'code', 'message'], properties: { severity: { enum: ['BLOCKER', 'MAJOR', 'MINOR', 'INFO'] }, code: { type: 'string' }, message: { type: 'string' } } } },
      checks_run: { type: 'array', items: { type: 'string' } }, commands: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' }, duration_ms: { type: 'number' },
    },
    allOf: [{ if: { properties: { status: { const: 'PASS' } } }, then: { properties: { executed: { const: true }, exit_code: { const: 0 } } } }],
  },
  'evidence.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/evidence', title: 'UAP Evidence',
    type: 'object', required: ['evidence_id', 'kind', 'recorded_at', 'environment', 'command', 'exit_code'],
    properties: {
      evidence_id: { type: 'string', pattern: '^UAP-EV-' }, kind: { type: 'string' }, task_id: { type: ['string', 'null'] },
      trace_id: { type: ['string', 'null'] }, specification_ids: { type: 'array' }, recorded_at: { type: 'string', format: 'date-time' },
      environment: { type: 'object', required: ['platform', 'node', 'cwd'] }, command: { type: ['string', 'null'] },
      exit_code: { type: ['integer', 'null'] }, duration_ms: { type: ['number', 'null'] },
      inputs: { type: 'string' }, stdout: { type: 'string' }, stderr: { type: 'string' },
      artifacts: { type: 'array' }, findings: { type: 'array' }, summary: { type: 'string' }, content_hash: { type: 'string' },
    },
  },
  'defect.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/defect', title: 'UAP Defect',
    type: 'object', required: ['id', 'title', 'severity', 'domain', 'root_cause', 'affected_files', 'affected_features', 'specification_ids', 'executor_id', 'validator_id', 'repair_strategy', 'repair_attempts', 'status', 'evidence_refs'],
    properties: {
      id: { type: 'string', pattern: '^UAP-DEFECT-\\d{4}$' }, title: { type: 'string' },
      severity: { enum: ['P0', 'P1', 'P2', 'P3', 'P4'] }, domain: { type: 'string' },
      root_cause: { type: 'string' }, affected_files: { type: 'array', items: { type: 'string' } },
      affected_features: { type: 'array', items: { type: 'string' } }, specification_ids: { type: 'array', items: { type: 'string' } },
      executor_id: { type: 'string' }, validator_id: { type: 'string' }, repair_strategy: { type: 'string' },
      repair_attempts: { type: 'integer', minimum: 0, maximum: 3 },
      status: { enum: ['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'BLOCKED', 'ACCEPTED_RISK'] },
      evidence_refs: { type: 'array', items: { type: 'string' } }, blocked_reason: { type: 'string' },
    },
  },
  'final-status.schema.json': {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'uap://schemas/final-status', title: 'UAP Final Status',
    type: 'object', required: ['platform', 'version', 'overall_status', 'specifications', 'machine_configs', 'system_entrypoints', 'runtime', 'executors', 'validators', 'uter_compliance', 'evidence_index'],
    properties: {
      platform: { const: 'UAP' }, version: { type: 'string' }, overall_status: { enum: statuses },
      specifications: { type: 'object' }, machine_configs: { type: 'object' }, system_entrypoints: { type: 'object' },
      runtime: { type: 'object' }, executors: { type: 'object' }, validators: { type: 'object' },
      uter_compliance: { enum: ['NOT_ASSESSED', 'PARTIALLY_COMPLIANT', 'NOT_FULLY_VERIFIED', 'FULLY_COMPLIANT', 'BLOCKED'] },
      critical_defects: { type: 'integer' }, open_defects: { type: 'integer' }, blocked_items: { type: 'array' },
      evidence_index: { type: 'string' },
    },
  },
};

for (const [name, schema] of Object.entries(schemas)) {
  fs.writeFileSync(path.join(SCHEMA_DIR, name), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
}
console.log(`generated ${Object.keys(schemas).length} schemas in ${SCHEMA_DIR}`);
