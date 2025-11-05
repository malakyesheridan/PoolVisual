/**
 * Prometheus Metrics for AI Enhancement System
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const registry = new Registry();

export const metrics = {
  outboxProcessedSuccess: new Counter({
    name: 'enhancement_outbox_processed_total',
    help: 'Outbox events processed successfully',
    labelNames: ['event_type'],
    registers: [registry]
  }),
  
  outboxProcessedFailed: new Counter({
    name: 'enhancement_outbox_failed_total',
    help: 'Outbox events terminal failures',
    labelNames: ['event_type', 'error_type'],
    registers: [registry]
  }),
  
  outboxRetry: new Counter({
    name: 'enhancement_outbox_retries_total',
    help: 'Outbox retry attempts',
    labelNames: ['attempt'],
    registers: [registry]
  }),
  
  jobsCreated: new Counter({
    name: 'enhancement_jobs_created_total',
    help: 'Jobs created',
    labelNames: ['provider', 'status'],
    registers: [registry]
  }),
  
  jobDuration: new Histogram({
    name: 'enhancement_job_duration_seconds',
    help: 'Job duration',
    labelNames: ['status', 'provider'],
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [registry]
  }),
  
  jobCost: new Histogram({
    name: 'enhancement_job_cost_micros',
    help: 'Job cost in microdollars',
    labelNames: ['provider'],
    buckets: [100000, 500000, 1000000, 5000000, 10000000],
    registers: [registry]
  }),
  
  activeJobs: new Gauge({
    name: 'enhancement_active_jobs',
    help: 'Active jobs by status',
    labelNames: ['status'],
    registers: [registry]
  })
};

export async function metricsHandler(_req: any, res: any) {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}

