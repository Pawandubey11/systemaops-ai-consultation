// Services are loaded from the backend API; this minimal set is used only if the
// network request fails entirely (e.g. offline / server not yet reachable).
const FALLBACK_SERVICES = [
  ['website-development','Website Development','Fast, conversion-focused web platforms.'],
  ['mobile-app-development','Mobile App Development','Native-quality mobile experiences.'],
  ['crm-development','CRM Development','Customer workflows built around your sales process.'],
  ['erp-solutions','ERP Solutions','Connected operations and business intelligence.'],
  ['ai-automation','AI Automation','Automate repetitive, high-impact business processes.'],
  ['ai-chatbots','AI Chatbots','Grounded support and sales assistants.'],
  ['cloud-infrastructure','Cloud Infrastructure','Secure, reliable cloud foundations.'],
  ['devops','DevOps & CI/CD','Faster releases with dependable delivery pipelines.'],
  ['data-engineering','Data Engineering','Trusted pipelines, warehouses, and analytics.'],
  ['api-development','API Development','Secure integrations that connect your systems.'],
  ['ui-ux-design','UI/UX Design','Research-led interfaces people enjoy using.'],
  ['custom-software','Custom Software','Purpose-built applications for complex operations.']
].map(([code, name, description]) => ({ code, name, description }));

// ── DOM refs ────────────────────────────────────────────────────────────────
const form          = document.querySelector('#consultationForm');
const servicePicker = document.querySelector('#servicePicker');
const preview       = document.querySelector('#servicePreview');
const nextButton    = document.querySelector('#nextButton');
const backButton    = document.querySelector('#backButton');
const submitButton  = document.querySelector('#submitButton');

// ── State ───────────────────────────────────────────────────────────────────
let currentStep     = 1;
let services        = FALLBACK_SERVICES;   // replaced by API response on load
let latestAnalysis  = null;
let latestPayload   = null;
let latestReference = '';

// ── Service loading ──────────────────────────────────────────────────────────
async function loadServices() {
  // Clear skeleton placeholders immediately
  preview.innerHTML = '';
  try {
    const response = await fetch('/api/services');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.services) && data.services.length) {
        services = data.services;
      }
    }
  } catch {
    // Network error — keep FALLBACK_SERVICES, no console noise needed
  }
  renderServices();
}

function renderServices() {
  preview.innerHTML = services.slice(0, 6).map((s, i) =>
    `<article class="service-card"><span class="icon">${String(i + 1).padStart(2, '0')}</span><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p></article>`
  ).join('');

  servicePicker.innerHTML = services.map(s =>
    `<label class="service-option"><input type="checkbox" name="services" value="${escapeHtml(s.code)}"><span>${escapeHtml(s.name)}</span></label>`
  ).join('');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(value) {
  const d = document.createElement('div');
  d.textContent = value;
  return d.innerHTML;
}

function selectedServices() {
  return [...form.querySelectorAll('[name="services"]:checked')]
    .map(el => services.find(s => s.code === el.value));
}

function updateConditionalFields() {
  const hasErp = selectedServices().some(service => service?.code === 'erp-solutions');
  document.querySelector('#erpOptions').hidden = !hasErp;
  if (!hasErp) form.querySelectorAll('[name="erpEdition"]').forEach(input => { input.checked = false; });
}

function validateStep() {
  document.querySelector('#serviceError').textContent = '';
  if (currentStep === 1 && !selectedServices().length) {
    document.querySelector('#serviceError').textContent = 'Select at least one service.';
    return false;
  }
  const fields = [...document.querySelector(`[data-step="${currentStep}"]`).querySelectorAll('[required]')];
  const invalid = fields.find(field => !field.checkValidity());
  if (invalid) { invalid.reportValidity(); return false; }
  return true;
}

// ── Step navigation ──────────────────────────────────────────────────────────
function showStep() {
  currentStep = Math.min(4, Math.max(1, currentStep));
  document.querySelectorAll('.form-step').forEach(step =>
    step.classList.toggle('active', Number(step.dataset.step) === currentStep)
  );
  const titles = ['Choose services', 'Your company', 'Project needs', 'Review & submit'];
  document.querySelector('#stepLabel').textContent   = `Step ${currentStep} of 4`;
  document.querySelector('#stepTitle').textContent   = titles[currentStep - 1];
  document.querySelector('#progressBar').style.width = `${currentStep * 25}%`;
  backButton.hidden   = currentStep === 1;
  nextButton.hidden   = currentStep === 4;
  submitButton.hidden = currentStep !== 4;
  if (currentStep === 4) buildReview();
}

function buildReview() {
  const data = new FormData(form);
  const rows = [
    ['Services',  selectedServices().map(s => s.name).join(', ')],
    ['Company',   data.get('companyName')],
    ['Industry',  data.get('industry')],
    ['Goals',     data.get('goals')],
    ['Timeline',  data.get('timeline')],
    ['Budget',    data.get('budget')]
  ];
  if (data.get('erpEdition')) rows.splice(2, 0, ['Preferred ERP edition', data.get('erpEdition')]);
  document.querySelector('#reviewPanel').innerHTML = rows
    .map(([label, value]) =>
      `<div class="review-row"><span>${label}</span><strong>${escapeHtml(value || 'Not provided')}</strong></div>`
    ).join('');
}

nextButton.addEventListener('click', () => {
  if (currentStep >= 4 || !validateStep()) return;
  currentStep = Math.min(4, currentStep + 1);
  showStep();
  document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

backButton.addEventListener('click', () => {
  if (currentStep <= 1) return;
  currentStep = Math.max(1, currentStep - 1);
  showStep();
});

// ── Form submission ──────────────────────────────────────────────────────────
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep()) return;

  const data   = new FormData(form);
  const status = document.querySelector('#formStatus');
  submitButton.disabled = true;
  status.textContent = 'Submitting your consultation… Our AI is analyzing your requirements and preparing your recommendations. This may take up to 5 minutes — please keep this page open.';

  const payload = {
    schemaVersion: '1.0',
    contact: { name: data.get('name'), email: data.get('email') },
    company: {
      name:        data.get('companyName'),
      industry:    data.get('industry'),
      size:        data.get('companySize'),
      website:     data.get('website'),
      description: data.get('description')
    },
    services: selectedServices().map(s => s.code),
    project: {
      challenges:     data.get('challenges'),
      goals:          data.get('goals'),
      existingSystems:data.get('systems'),
      timeline:       data.get('timeline'),
      budget:         data.get('budget'),
      erpEdition:     data.get('erpEdition') || null,
      requirements:   data.get('requirements')
    },
    consent: { accepted: data.get('consent') === 'on', acceptedAt: new Date().toISOString() }
  };

  try {
    const response    = await fetch('/api/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    let result = {};
    if (responseText) {
      try { result = JSON.parse(responseText); } catch {
        throw new Error(response.ok
          ? 'The server returned an unreadable response. Please try again.'
          : 'The public connection was interrupted. Please try again or ask SystemaOps for a new link.');
      }
    }
    if (!response.ok) throw new Error(result.error || `Could not submit the consultation (error ${response.status}).`);
    if (!result.reference) throw new Error('The submission response was incomplete. Please try again.');

    latestPayload   = payload;
    latestReference = result.reference;

    const completed  = await waitForAnalysis(result.reference, status);
    latestAnalysis   = completed.analysis;
    form.hidden      = true;
    document.querySelector('.progress').hidden      = true;
    document.querySelector('#referenceNumber').textContent = result.reference;
    document.querySelector('#successPanel').hidden  = false;
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? 'The connection was interrupted before the analysis completed. Please check the public link and try again.'
      : error.message;
    submitButton.disabled = false;
  }
});

// ── Polling — deadline extended to 5 min to match server max (90s × 3 retries) ──
async function waitForAnalysis(reference, status) {
  const deadline = Date.now() + 300000; // 5 minutes
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const response = await fetch(`/api/consultations/${encodeURIComponent(reference)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Could not check the consultation analysis status. Please try again.');
    const result = await response.json();
    if (result.status === 'analysis_ready' && result.analysis) return result;
    if (result.status === 'failed') throw new Error('AI analysis is temporarily unavailable. Please try again shortly.');
    status.textContent = 'Your request was received. AI analysis is in progress — this may take up to 5 minutes. Please keep this page open.';
  }
  throw new Error(`Analysis is taking longer than expected. Keep your reference ${reference} and try again shortly.`);
}

// ── Success panel ────────────────────────────────────────────────────────────
document.querySelector('#newRequest').addEventListener('click', () => location.reload());
servicePicker.addEventListener('change', updateConditionalFields);

// ── Report rendering ─────────────────────────────────────────────────────────
function fillList(id, items) {
  document.querySelector(id).innerHTML = items.map(item => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderReport() {
  if (!latestAnalysis) return;
  const a = latestAnalysis;

  document.querySelector('#reportCompany').textContent  = escapeHtml(latestPayload.company.name);
  document.querySelector('#reportSummary').textContent  = a.executiveSummary;
  document.querySelector('#reportReference').textContent = latestReference;

  fillList('#reportSolution',     a.proposedSolution);
  fillList('#reportArchitecture', a.architecture);
  fillList('#reportAi',           a.aiOpportunities);
  fillList('#reportSecurity',     a.security);
  fillList('#reportRisks',        a.risks);
  fillList('#reportAssumptions',  a.assumptions);
  fillList('#reportNext',         a.nextSteps);

  document.querySelector('#reportStack').innerHTML = a.technologyStack
    .map(item => `<span>${escapeHtml(item)}</span>`).join('');

  document.querySelector('#reportRoadmap').innerHTML = a.roadmap
    .map(item =>
      `<div><b>Phase ${escapeHtml(String(item.phase))}</b><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.duration)}</span></div>`
    ).join('');

  document.querySelector('#reportDisclaimer').textContent = a.disclaimer;

  // Smooth fade-in reveal
  const reportEl = document.querySelector('#report');
  reportEl.hidden = false;
  // Force reflow so transition triggers after display change
  void reportEl.offsetWidth;
  reportEl.classList.add('visible');
  reportEl.scrollIntoView({ behavior: 'smooth' });
}

document.querySelector('#viewReport').addEventListener('click', renderReport);

// ── PDF download ─────────────────────────────────────────────────────────────
document.querySelector('#downloadReport').addEventListener('click', async () => {
  const button = document.querySelector('#downloadReport');
  if (!latestReference) return;
  button.disabled    = true;
  button.textContent = 'Preparing PDF…';
  try {
    const response = await fetch(`/api/consultations/${encodeURIComponent(latestReference)}/pdf`);
    if (!response.ok) throw new Error('PDF generation failed. Please try again shortly.');
    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `SystemaOps-${latestReference}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled    = false;
    button.textContent = 'Download PDF';
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────
loadServices();
