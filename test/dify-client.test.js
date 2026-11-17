import test from 'node:test';
import assert from 'node:assert/strict';
import { runConsultationWorkflow } from '../lib/dify-client.js';
import { normalizeAnalysis } from '../lib/analysis-schema.js';

const payload = { contact: { email: 'client@example.com' }, company: { name: 'Client' }, services: ['website-development'], project: {} };
const validAnalysis = {
  executiveSummary: 'A clear plan.', proposedSolution: ['Build the platform'], technologyStack: ['Node.js'],
  architecture: ['Web client', 'API'], roadmap: [{ phase: 1, name: 'Discovery', duration: '1 week' }],
  aiOpportunities: ['Automate intake'], security: ['Use HTTPS'], risks: ['Scope growth'],
  assumptions: ['Scope requires confirmation'], nextSteps: ['Run discovery'], disclaimer: 'Preliminary.'
};
const config = { baseUrl: 'https://dify.test/v1', apiKey: 'secret', appType: 'workflow', inputName: 'consultation_json', outputName: 'analysis', timeoutMs: 1000, maxRetries: 1 };

test('normalizes Dify JSON string output to the existing report contract', () => {
  const result = normalizeAnalysis(JSON.stringify(validAnalysis));
  assert.equal(result.mode, 'dify-workflow');
  assert.equal(result.executiveSummary, 'A clear plan.');
  assert.equal(result.roadmap[0].phase, 1);
});

test('sends workflow request with server-side bearer authentication', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ task_id: 'task', workflow_run_id: 'run', data: { status: 'succeeded', outputs: { analysis: validAnalysis }, elapsed_time: 1, total_tokens: 50 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await runConsultationWorkflow(payload, { config, fetchImpl });
  assert.equal(request.url, 'https://dify.test/v1/workflows/run');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  const body = JSON.parse(request.options.body);
  assert.equal(body.response_mode, 'blocking');
  assert.equal(JSON.parse(body.inputs.consultation_json).company.name, 'Client');
  assert.equal(result.metadata.workflowRunId, 'run');
});

test('retries retryable Dify failures', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ message: 'busy' }), { status: 503 });
    return new Response(JSON.stringify({ task_id: 'task', workflow_run_id: 'run', data: { status: 'succeeded', outputs: { analysis: validAnalysis } } }), { status: 200 });
  };
  await runConsultationWorkflow(payload, { config, fetchImpl });
  assert.equal(calls, 2);
});

test('supports the supplied Dify Chatflow app contract', async () => {
  let request;
  const chatConfig = { ...config, appType: 'chatflow' };
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ task_id: 'task', message_id: 'message', conversation_id: 'conversation', answer: JSON.stringify(validAnalysis), metadata: { usage: { total_tokens: 80, latency: 1.2 } } }), { status: 200 });
  };
  const result = await runConsultationWorkflow(payload, { config: chatConfig, fetchImpl });
  assert.equal(request.url, 'https://dify.test/v1/chat-messages');
  const body = JSON.parse(request.options.body);
  assert.equal(JSON.parse(body.query).company.name, 'Client');
  assert.equal(result.metadata.conversationId, 'conversation');
});

test('rejects incomplete workflow output before it reaches the frontend', () => {
  assert.throws(() => normalizeAnalysis({ executiveSummary: 'Incomplete' }), /missing array/);
});
