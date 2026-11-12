# Performance & Reliability Specification

## Overview

This document specifies the performance optimization, reliability, and monitoring features for Happy House Bills. The goal is to ensure the application performs well under load and provides excellent user experience.

## Scope

### In Scope
- Database query optimization
- Caching strategies (in-memory, client-side)
- Circuit breaker patterns
- Performance monitoring and alerting
- Error handling improvements
- Code optimization (deduplication)

### Out of Scope
- Database schema changes
- New feature development
- UI/UX improvements
- Advanced machine learning models
- Real-time processing capabilities

## Architecture

### Caching Layer
```
Client Request
    ↓
useConvexQuery (built-in Convex caching)
    ↓
Client-side LRU Cache (app/utils/cache.ts)
    ↓
Circuit Breaker (app/utils/circuit-breakers.ts)
    ↓
Convex Query
```

### Circuit Breaker Pattern
- State: Closed → Open → Half-Open → Closed
- Failure threshold: 5 failures
- Recovery timeout: 30 seconds
- Applied to: External API calls, Convex mutations

### Monitoring
- Health check endpoint
- Slow query logging (threshold: 1000ms)
- Performance metrics aggregation
- Circuit breaker status dashboard

## Implementation Details

### 1. Database Query Optimization

Current indexes (schema.ts):
- `expenses.by_org` — orgId
- `expenses.by_org_date` — orgId + date
- `expenses.by_org_status_date` — orgId + status + date

Optimization targets:
- Analytics queries already use composite index filtering
- Add `expenses.by_org_deletedAt_status` for soft-delete queries
- Monitor query execution time via `performance.benchmark`

### 2. Caching Strategy

| Layer | TTL | Max Size | Use Case |
|-------|-----|----------|----------|
| Convex | Built-in | Unlimited | Query result caching |
| Client LRU | 60s | 100 | Repeated component queries |
| Memoization | 60s | 100 | Computed derived data |

### 3. Circuit Breaker

Applied to:
- External API integrations (bank, accounting, travel)
- Convex mutations with side effects
- Health check endpoints

Configuration per circuit:
```typescript
{
  failureThreshold: 5,
  recoveryTimeout: 30000,
  name: "integration:bank"
}
```

### 4. Monitoring

Queries:
- `performance.benchmark` — measure query performance
- `performance.healthCheck` — verify system status
- `monitoring.circuitBreakerStatus` — circuit breaker states
- `monitoring.slowQueryLog` — queries exceeding threshold
- `monitoring.performanceMetrics` — aggregated metrics

### 5. Code Optimization

Duplicate `periodDays` constants merged:
- Before: `analytics.ts` lines 18-23, `predictions.ts` lines 27-31
- After: Shared constant in `convex/functions/shared-constants.ts`

## Acceptance Criteria

- [ ] Database queries optimized
- [ ] Caching layers implemented
- [ ] Load balancing configured (handled by Cloudflare Workers)
- [ ] Performance monitoring operational
- [ ] Error handling robust
- [ ] Backup and recovery functional
- [ ] Security hardening applied
- [ ] Code optimization complete
- [ ] CDN integration working (handled by Cloudflare Workers)

## Testing Strategy

- Unit tests for cache utilities (LRU, memoization)
- Unit tests for circuit breaker (state transitions, failure threshold)
- Integration tests for monitoring queries
- Performance benchmarks (target: <100ms avg query time)

## Caching Data Classification (SEC-D16-09)

- Cache only non-secret, non-sensitive derived data (e.g. computed summaries, UI-safe aggregates).
- Never cache secrets, auth tokens, credentials, or raw PII values.
- Use stable keys; avoid embedding PII in cache keys (SEC-D16-06).
- Clear session-scoped caches on sign-out/auth boundary changes (SEC-D16-08 follow-up where caches are used).
- `JSON.stringify` keying is acceptable for simple primitive/object args; complex keying requires a stable serializer if collision risk matters.
- `stableKeySerializer` (exported from `app/utils/cache.ts`) provides deterministic serialization by sorting object keys recursively; use when cache keys contain objects with non-deterministic property order.

## Open Questions

| ID | Question | Owner | Target Phase |
|----|----------|-------|--------------|
| PERF-Q1 | How should we handle database optimization? | backend-engineer | Phase 3 — Added `expenses.by_org_deletedAt_status` composite index; analytics/insights/predictions already use `by_org_status_date`; monitor via `performance.benchmark` |
| PERF-Q2 | What's the best caching strategy? | backend-engineer | Phase 3 — Three-layer strategy decided: Convex built-in (unlimited), Client LRU (60s/100), Memoization (60s/100); session-scoped caches clear on sign-out |
| PERF-Q3 | How should we implement monitoring? | devops | Phase 3 — Implemented: `performance.benchmark`/`healthCheck`, `monitoring.circuitBreakerStatus`/`slowQueryLog`/`performanceMetrics`; dashboard in `PerformanceDashboard.vue` |

## Dependencies

- Depends on: D15 (analytics infrastructure)
- Blocks: None

## References

- `convex/functions/performance.ts` — benchmark + health check
- `convex/functions/monitoring.ts` — circuit breaker status, slow queries
- `app/utils/cache.ts` — LRU cache + memoization
- `app/utils/circuit-breakers.ts` — circuit breaker implementation
- `app/composables/usePerformance.ts` — performance hooks
- `app/components/PerformanceDashboard.vue` — monitoring UI