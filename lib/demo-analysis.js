const knowledge = {
  'website-development': { stack: ['HTML5', 'CSS3', 'Vanilla JavaScript', 'Node.js', 'Express'], pattern: 'SEO-ready responsive web application', phases: ['UX and content planning', 'Frontend and API development', 'Testing and AWS deployment'] },
  'mobile-app-development': { stack: ['Flutter', 'Node.js', 'MongoDB'], pattern: 'Cross-platform mobile application with secure APIs', phases: ['Product discovery', 'Mobile and API development', 'Store release'] },
  'crm-development': { stack: ['Node.js', 'Express', 'MongoDB', 'Redis'], pattern: 'Role-based modular CRM with integration APIs', phases: ['Process mapping', 'Core CRM implementation', 'Migration and rollout'] },
  'erp-solutions': { stack: ['Node.js', 'PostgreSQL', 'Redis', 'AWS'], pattern: 'Modular ERP with auditable business workflows', phases: ['Workflow discovery', 'Module delivery', 'Data migration and adoption'] },
  'ai-automation': { stack: ['Dify', 'Node.js', 'Knowledge Base', 'Workflow Queue'], pattern: 'Human-supervised AI automation workflow', phases: ['Automation discovery', 'AI pilot and evaluation', 'Controlled production rollout'] },
  'ai-chatbots': { stack: ['Dify', 'RAG', 'Knowledge Base', 'Node.js'], pattern: 'Grounded assistant with citations and human escalation', phases: ['Knowledge preparation', 'Assistant implementation', 'Evaluation and launch'] },
  'cloud-infrastructure': { stack: ['AWS', 'Terraform', 'CloudWatch'], pattern: 'Secure multi-environment AWS foundation', phases: ['Cloud assessment', 'Infrastructure as code', 'Migration and optimization'] },
  'devops': { stack: ['GitHub Actions', 'Docker', 'AWS', 'Terraform'], pattern: 'Automated CI/CD with observable deployments', phases: ['Delivery audit', 'Pipeline implementation', 'Reliability hardening'] },
  'data-engineering': { stack: ['Python', 'Airflow', 'PostgreSQL', 'AWS S3'], pattern: 'Governed batch and event data platform', phases: ['Source assessment', 'Pipeline and model delivery', 'Quality and observability'] },
  'api-development': { stack: ['Node.js', 'Express', 'OpenAPI', 'Redis'], pattern: 'Versioned and rate-limited integration API', phases: ['Contract design', 'API implementation', 'Security and load testing'] },
  'ui-ux-design': { stack: ['Figma', 'Design System', 'Accessibility Testing'], pattern: 'Research-led accessible product experience', phases: ['User research', 'Prototype and testing', 'Design system handoff'] },
  'custom-software': { stack: ['HTML5', 'CSS3', 'JavaScript', 'Node.js', 'MongoDB', 'AWS'], pattern: 'Modular cloud application designed for incremental growth', phases: ['Discovery and architecture', 'MVP implementation', 'Production hardening'] }
};

export function createFallbackAnalysis(payload) {
  const selected = payload.services.map(code => knowledge[code]).filter(Boolean);
  const stack = [...new Set(selected.flatMap(item => item.stack))];
  const phases = [...new Set(selected.flatMap(item => item.phases))];
  return {
    mode: 'deterministic-fallback', generatedAt: new Date().toISOString(),
    executiveSummary: `${payload.company.name} wants to ${(payload.project.goals || 'improve digital operations').toLowerCase()}. Based on the submitted requirements and the SystemaOps service catalog, we recommend a phased solution that addresses ${(payload.project.challenges || 'manual and disconnected processes').toLowerCase()} while keeping delivery risk controlled.`,
    proposedSolution: selected.map(item => item.pattern), technologyStack: stack,
    architecture: ['Responsive HTML/CSS/JavaScript client', 'Node.js and Express application API', stack.includes('MongoDB') ? 'MongoDB operational database' : 'Managed project database', 'AWS hosting with monitoring, backups, and secure configuration'],
    roadmap: phases.map((name, index) => ({ phase: index + 1, name, duration: index === 0 ? '1-2 weeks' : '2-4 weeks' })),
    aiOpportunities: payload.services.some(code => code.startsWith('ai-')) ? ['Ground recommendations with an approved Dify knowledge base', 'Keep human approval for sensitive or customer-facing actions', 'Track workflow, model, evidence, and output versions'] : ['Add AI-assisted search and support after the core platform is stable', 'Use analytics to identify repetitive workflows suitable for automation'],
    security: ['Use HTTPS, secure headers, input validation, and rate limits', 'Store secrets outside source code', 'Apply role-based access and audit important actions', 'Encrypt backups and restrict production database access'],
    risks: ['Scope growth without prioritized requirements', 'Unknown integration constraints', 'Content and stakeholder approval delays'],
    assumptions: [`Target timeline: ${payload.project.timeline || 'Not decided'}`, `Budget guidance: ${payload.project.budget || 'Prefer not to disclose'}`, ...(payload.project.erpEdition ? [`Preferred ERP edition: ${payload.project.erpEdition}`] : []), 'All estimates are in Indian Rupees (INR) and exclude applicable taxes, including GST', 'Final costs depend on confirmed scope, modules, integrations, customization, hosting, and user count'],
    nextSteps: ['Confirm MVP features and success metrics', 'Review integrations and current systems', 'Approve architecture and delivery phase 1', 'Schedule a technical discovery workshop'],
    disclaimer: 'This is a fallback consultation generated without Dify. It is not a commercial offer and requires SystemaOps review.'
  };
}
