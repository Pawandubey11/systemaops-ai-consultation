import { normalizeAnalysis } from './analysis-schema.js';
import { createHash } from 'node:crypto';

const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export function difyConfig(env = process.env) {
  return {
    baseUrl: (env.DIFY_BASE_URL || 'https://api.dify.ai/v1').replace(/\/$/, ''),
    apiKey: env.DIFY_API_KEY || '',
    appType: env.DIFY_APP_TYPE || 'chatflow',
    inputName: env.DIFY_INPUT_NAME || 'consultation_json',
    outputName: env.DIFY_OUTPUT_NAME || 'analysis',
    timeoutMs: positiveInt(env.DIFY_TIMEOUT_MS, 90000),
    maxRetries: positiveInt(env.DIFY_MAX_RETRIES, 2)
  };
}

export function isDifyConfigured(config = difyConfig()) {
  return Boolean(config.baseUrl && config.apiKey);
}

export async function runConsultationWorkflow(payload, options = {}) {
  const config = options.config || difyConfig();
  const fetchImpl = options.fetchImpl || fetch;
  if (!isDifyConfigured(config)) throw new Error('Dify is not configured.');
  const user = `consultation-${createHash('sha256').update(payload.contact?.email || 'anonymous').digest('hex').slice(0, 24)}`;
  const isChatflow = config.appType === 'chatflow';
  const body = isChatflow
    ? { inputs: {}, query: JSON.stringify(payload), response_mode: 'blocking', user }
    : { inputs: { [config.inputName]: JSON.stringify(payload) }, response_mode: 'blocking', user };
  const endpoint = isChatflow ? '/chat-messages' : '/workflows/run';

  let lastError;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}${endpoint}`, {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(`Dify request failed with status ${response.status}.`);
        error.status = response.status; error.details = responseBody;
        throw error;
      }
      if (isChatflow) {
        return { analysis: normalizeAnalysis(responseBody.answer), metadata: { taskId: responseBody.task_id, messageId: responseBody.message_id, conversationId: responseBody.conversation_id, totalTokens: responseBody.metadata?.usage?.total_tokens, elapsedTime: responseBody.metadata?.usage?.latency } };
      }
      if (responseBody.data?.status !== 'succeeded') throw new Error(responseBody.data?.error || 'Dify workflow did not succeed.');
      const output = responseBody.data.outputs?.[config.outputName];
      return { analysis: normalizeAnalysis(output), metadata: { taskId: responseBody.task_id, workflowRunId: responseBody.workflow_run_id, elapsedTime: responseBody.data.elapsed_time, totalTokens: responseBody.data.total_tokens } };
    } catch (error) {
      lastError = error;
      const retryable = error.name === 'AbortError' || RETRYABLE.has(error.status);
      if (!retryable || attempt === config.maxRetries) break;
      await delay(Math.min(500 * (2 ** attempt) + Math.floor(Math.random() * 200), 3000));
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

function positiveInt(value, fallback) {
  const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : fallback;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
