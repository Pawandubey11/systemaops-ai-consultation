const REQUIRED_ARRAYS = [
  'proposedSolution', 'technologyStack', 'architecture', 'roadmap',
  'aiOpportunities', 'security', 'risks', 'assumptions', 'nextSteps'
];

export function normalizeAnalysis(value) {
  const raw = typeof value === 'string' ? parseJson(value) : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Dify output must be a JSON object.');
  }
  if (typeof raw.executiveSummary !== 'string' || !raw.executiveSummary.trim()) {
    throw new Error('Dify output is missing executiveSummary.');
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(raw[key])) throw new Error(`Dify output is missing array: ${key}.`);
  }
  return {
    mode: 'dify-workflow',
    generatedAt: new Date().toISOString(),
    executiveSummary: raw.executiveSummary.trim(),
    proposedSolution: strings(raw.proposedSolution),
    technologyStack: strings(raw.technologyStack),
    architecture: strings(raw.architecture),
    roadmap: raw.roadmap.map((item, index) => ({
      phase: Number(item?.phase) || index + 1,
      name: String(item?.name || '').trim(),
      duration: String(item?.duration || '').trim()
    })).filter(item => item.name),
    aiOpportunities: strings(raw.aiOpportunities),
    security: strings(raw.security),
    risks: strings(raw.risks),
    assumptions: strings(raw.assumptions),
    nextSteps: strings(raw.nextSteps),
    disclaimer: String(raw.disclaimer || 'This consultation is preliminary and requires SystemaOps review.').trim()
  };
}

function strings(items) {
  return items.map(item => String(item).trim()).filter(Boolean);
}

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); }
  catch { throw new Error('Dify analysis output is not valid JSON.'); }
}
