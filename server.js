import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createFallbackAnalysis } from './lib/demo-analysis.js';
import { difyConfig, isDifyConfigured, runConsultationWorkflow } from './lib/dify-client.js';

// ---------------------------------------------------------------------------
// Startup validation — catch misconfiguration early
// ---------------------------------------------------------------------------

const config = difyConfig();
const fallbackEnabled = process.env.DIFY_FALLBACK_ENABLED !== 'false';

if (!isDifyConfigured(config) && !fallbackEnabled) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    event: 'startup_misconfiguration',
    message: 'DIFY_API_KEY is not set AND DIFY_FALLBACK_ENABLED is false. All consultations will fail. Set DIFY_API_KEY or set DIFY_FALLBACK_ENABLED=true.'
  }));
}

if (!process.env.MONGODB_URI) {
  log('startup_warning', { message: 'MONGODB_URI is not set. Using in-memory storage — data will be lost on restart.' }, 'warn');
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
const port = Number(process.env.PORT || 3000);

// CORS — restrict to same origin in production, allow configured origins
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept', 'x-request-id'],
  credentials: false
}));

// Security headers with proper CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// Compress all responses
app.use(compression());

app.use(express.json({ limit: '1mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || randomUUID();
  res.set('x-request-id', req.requestId);
  const started = Date.now();
  res.on('finish', () => log('http_request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    status: res.statusCode,
    durationMs: Date.now() - started
  }));
  next();
});

app.use(morgan('tiny', { skip: () => process.env.NODE_ENV === 'test' }));

// Serve static files with caching headers
app.use(express.static('public', {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    // Cache static assets for 1 hour, HTML never cached
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    } else {
      res.set('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const consultationSchema = new mongoose.Schema({
  reference: { type: String, unique: true, index: true },
  status: { type: String, default: 'submitted' },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  analysis: mongoose.Schema.Types.Mixed,
  aiMetadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const Consultation = mongoose.model('Consultation', consultationSchema);
const memoryStore = new Map();
let databaseReady = false;

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => { databaseReady = true; log('mongodb_connected'); })
    .catch(error => log('mongodb_connection_failed', { error: error.message }, 'warn'));
}

// ---------------------------------------------------------------------------
// Services catalog — single source of truth
// ---------------------------------------------------------------------------

const services = [
  ['website-development',  'Website Development',  'Fast, conversion-focused web platforms.'],
  ['mobile-app-development','Mobile App Development','Native-quality mobile experiences.'],
  ['crm-development',      'CRM Development',      'Customer workflows built around your sales process.'],
  ['erp-solutions',        'ERP Solutions',        'Connected operations and business intelligence.'],
  ['ai-automation',        'AI Automation',        'Automate repetitive, high-impact business processes.'],
  ['ai-chatbots',          'AI Chatbots',          'Grounded support and sales assistants.'],
  ['cloud-infrastructure', 'Cloud Infrastructure', 'Secure, reliable cloud foundations.'],
  ['devops',               'DevOps & CI/CD',       'Faster releases with dependable delivery pipelines.'],
  ['data-engineering',     'Data Engineering',     'Trusted pipelines, warehouses, and analytics.'],
  ['api-development',      'API Development',      'Secure integrations that connect your systems.'],
  ['ui-ux-design',         'UI/UX Design',         'Research-led accessible interfaces people enjoy using.'],
  ['custom-software',      'Custom Software',      'Purpose-built applications for complex operations.']
].map(([code, name, description]) => ({ code, name, description }));

// ---------------------------------------------------------------------------
// Rate limiters (using express-rate-limit — production-safe)
// ---------------------------------------------------------------------------

const consultationLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.CONSULTATION_RATE_LIMIT || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many consultation requests. Please try again shortly.' }
});

const pdfLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many PDF requests. Please try again shortly.' }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  database: databaseReady ? 'mongodb' : 'memory',
  ai: { provider: 'dify', configured: isDifyConfigured(config), fallbackEnabled }
}));

// Services — cached for 5 minutes
app.get('/api/services', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ services });
});

// Submit consultation
app.post('/api/consultations', consultationLimiter, async (req, res) => {
  const payload = req.body;
  const required = ['contact', 'company', 'services', 'project'];
  const missing = required.filter(key => !payload?.[key]);

  if (missing.length || !payload.contact?.email || !payload.company?.name || !payload.services?.length) {
    return res.status(422).json({ error: 'Please complete all required fields.', missing });
  }

  // Use full UUID for unguessable references (P0-002: security improvement)
  const reference = `CON-${new Date().getFullYear()}-${randomUUID().toUpperCase()}`;
  const record = {
    reference,
    status: 'processing',
    payload,
    analysis: null,
    aiMetadata: { provider: 'dify', fallback: false },
    createdAt: new Date().toISOString()
  };

  if (databaseReady) await Consultation.create(record);
  else memoryStore.set(reference, record);

  res.status(202).json({ reference, status: record.status });
  void processConsultation(record, req.requestId);
});

// Get consultation by reference — no-store to prevent caching sensitive data
app.get('/api/consultations/:reference', async (req, res) => {
  const record = await findConsultation(req.params.reference);
  if (!record) return res.status(404).json({ error: 'Consultation not found.' });
  res.set('Cache-Control', 'no-store');
  return res.json(record);
});

// Generate PDF
app.get('/api/consultations/:reference/pdf', pdfLimiter, async (req, res) => {
  const record = await findConsultation(req.params.reference);
  if (!record?.analysis) return res.status(404).json({ error: 'Consultation report not found.' });

  // FIX P1-003: Removed hardcoded developer-specific Windows path
  const python = process.env.PDF_PYTHON || 'python3';
  const generator = spawn(python, [path.resolve('scripts/generate_consultation_pdf.py')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const chunks = [];
  const errors = [];

  // FIX P2-009: Kill PDF subprocess if it takes more than 30 seconds
  const killTimer = setTimeout(() => {
    if (!res.headersSent) {
      generator.kill('SIGKILL');
      res.status(504).json({ error: 'PDF generation timed out. Please try again.' });
    }
  }, 30_000);

  generator.stdout.on('data', chunk => chunks.push(chunk));
  generator.stderr.on('data', chunk => errors.push(chunk));

  generator.on('error', error => {
    clearTimeout(killTimer);
    if (!res.headersSent) {
      res.status(500).json({ error: `PDF generator unavailable: ${error.message}` });
    }
  });

  generator.on('close', code => {
    clearTimeout(killTimer);
    if (res.headersSent) return;
    if (code !== 0) {
      return res.status(500).json({
        error: 'PDF generation failed.',
        detail: Buffer.concat(errors).toString().slice(0, 500)
      });
    }
    const pdf = Buffer.concat(chunks);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="SystemaOps-${record.reference}.pdf"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'no-store'
    });
    return res.send(pdf);
  });

  generator.stdin.end(JSON.stringify(record));
});

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// ---------------------------------------------------------------------------
// AI Processing
// ---------------------------------------------------------------------------

async function processConsultation(record, requestId) {
  const { reference, payload } = record;
  let analysis;
  let aiMetadata = { provider: 'dify', fallback: false };

  try {
    if (!isDifyConfigured(config)) throw new Error('Dify is not configured.');
    const result = await runConsultationWorkflow(payload, { config });
    analysis = result.analysis;
    aiMetadata = { ...aiMetadata, ...result.metadata };
    log('dify_workflow_succeeded', {
      requestId,
      reference,
      workflowRunId: result.metadata.workflowRunId,
      durationMs: result.metadata.elapsedTime,
      totalTokens: result.metadata.totalTokens
    });
  } catch (error) {
    log('dify_workflow_failed', { requestId, reference, error: error.message, status: error.status }, 'warn');
    if (!fallbackEnabled) {
      await updateConsultation(reference, {
        status: 'failed',
        aiMetadata: { ...aiMetadata, error: 'AI analysis is temporarily unavailable.' }
      });
      return;
    }
    analysis = createFallbackAnalysis(payload);
    aiMetadata = { provider: 'dify', fallback: true, fallbackReason: error.message };
  }

  await updateConsultation(reference, { status: 'analysis_ready', analysis, aiMetadata });
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

async function findConsultation(reference) {
  return databaseReady
    ? Consultation.findOne({ reference }).lean()
    : memoryStore.get(reference);
}

async function updateConsultation(reference, changes) {
  if (databaseReady) return Consultation.updateOne({ reference }, { $set: changes });
  const current = memoryStore.get(reference);
  if (current) memoryStore.set(reference, { ...current, ...changes });
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(event, fields = {}, level = 'info') {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields });
  (level === 'warn' || level === 'error' ? console.warn : console.log)(entry);
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(port, () => log('server_started', {
  port,
  difyConfigured: isDifyConfigured(config),
  fallbackEnabled,
  database: databaseReady ? 'mongodb' : 'memory'
}));
