---
status: Draft
package: integrations
priority: P0
created: 05-November-2026
updated: 05-November-2026
tags: [integrations, backend, api-gateway]
---

# Integration Spec

## Purpose

Implement external service integrations to connect Happy House Bills with third-party providers. This includes banking (Plaid/Yodlee), accounting (QuickBooks/Xero/Travelport/skyscanner), travel, payment processing, OCR, cloud storage, and analytics services. Enables automatic expense sync, real-time data flow, and third-party service management from the admin dashboard.

## Scope

### In scope

- **Banking integration** — Plaid/Yodlee provider support for automatic account and transaction sync
- **Accounting integration** — QuickBooks, Xero, and Wave provider support for transaction and account sync
- **Travel integration** — Skyscanner/Expedia/Travelport for flight and hotel data
- **Payment processing** — Integrated payment service sync
- **OCR service** — Advanced receipt OCR integration (enhanced accuracy beyond Tesseract.js)
- **Cloud storage** — R2 and other cloud storage provider integration
- **Email service** — Resend and other email provider integration
- **Analytics service** — Data warehouse and analytics platform integration
- **API gateway** — Centralized HTTP client for all external service calls with retry, rate limiting, and timeout handling
- **Integration management dashboard** — Admin UI for connecting, configuring, and monitoring all integrations
- **Sync logs** — Detailed logging of all integration sync operations with error tracking
- **Webhook handling** — Provider webhook event receipt and processing
- **Connection testing** — Built-in connection validation for each provider type
- **Multi-org support** — Each organization can have independent integrations

### Out of scope

- Native mobile app integrations
- Desktop application integrations
- Blockchain integration
- IoT device integrations
- Advanced machine learning APIs
- Direct bank API access (all banking goes through Plaid/Yodlee abstraction)
- CSV/bank statement import (covered by receipt OCR and duplicate detection)
- Dispute workflow (reject + note is sufficient)
- Audit trail UI (covered by auditLogs table)
- Multi-currency support (v1 uses USD only)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Adapter pattern** | Consistent integration approach — each provider gets its own adapter module (`bank-api.ts`, `accounting-api.ts`, `travel-api.ts`) with a common interface |
| **OAuth 2.0 for auth** | Secure external service access with token-based authentication; credentials stored encrypted in Convex DB |
| **Webhooks for real-time** | Push notifications from external services for immediate sync instead of polling-only |
| **Retry logic with exponential backoff** | Reliable integrations — transient failures are retried with increasing delays |
| **Rate limiting** | Fair API usage — global rate limits per org to prevent abuse and control costs |
| **API gateway** | Centralized HTTP client (`api-gateway.ts`) with unified error handling, retry, timeout, and auth token management |
| **Integration status lifecycle** | `pending → connected → error/disconnected` — clear lifecycle state for each integration |
| **Sync log audit trail** | Every sync operation logged in `integrationSyncLogs` with records processed/created/updated/skipped counts |
| **Webhook events** | Provider events received and processed via `webhooks` table with status tracking |
| **Provider abstraction** | Type constants (`INTEGRATION_TYPES`) ensure type-safe provider references across frontend and backend |

## Acceptance Criteria

- [ ] Banking integration functional — Plaid and Yodlee providers supported, connection testable, accounts and transactions syncable
- [ ] Accounting integration functional — QuickBooks, Xero, and Wave providers supported, transactions and accounts syncable
- [ ] Travel integration functional — Skyscanner, Expedia, and Travelport providers supported, flights and hotels syncable
- [ ] Payment processing integration functional — Provider integration operational
- [ ] OCR service integration functional — Advanced OCR beyond Tesseract.js accuracy
- [ ] Cloud storage integration functional — R2 and other providers supported
- [ ] Email service integration functional — Resend and other providers supported
- [ ] Analytics service integration functional — Data warehouse platform supported
- [ ] API gateway operational — All external HTTP calls go through gateway with retry/timeout/error handling
- [ ] Integration management dashboard functional — Admin can connect, configure, sync, and disconnect all integrations
- [ ] Sync logs recorded — Every sync operation logged with status, record counts, and error tracking
- [ ] Webhook events received — Provider webhook events received and processed with status tracking
- [ ] Connection testing — Each provider type has a testable connection endpoint
- [ ] Multi-org support — Each organization can have independent integrations with independent configurations

## Files Created/Modified

| Path | Action |
|------|--------|
| `convex/functions/api-gateway.ts` | Create — HTTP client with retry, timeout, error handling |
| `convex/functions/integrations.ts` | Create — integration CRUD, sync, webhooks |
| `convex/functions/bank-api.ts` | Create — Plaid/Yodlee/mock banking adapter |
| `convex/functions/accounting-api.ts` | Create — QuickBooks/Xero/Wave/mock accounting adapter |
| `convex/functions/travel-api.ts` | Create — Skyscanner/Expedia/Travelport/mock travel adapter |
| `app/components/IntegrationDashboard.vue` | Create — admin dashboard for integration management |
| `app/composables/useIntegrations.ts` | Create — Vue composable for integration operations |
| `app/utils/api-gateway.ts` | Create — frontend ApiGateway class |
| `docs/specs/integrations/integration-spec.md` | Create — this spec file |
| `__tests__/convex/integrations.test.ts` | Create — integration unit tests |
| `__tests__/convex/bank-api.security.test.ts` | Create — security tests for bank API |
| `__tests__/convex/accounting-api.security.test.ts` | Create — security tests for accounting API |
| `__tests__/convex/travel-api.security.test.ts` | Create — security tests for travel API |

## Open Questions

| ID | Question | Status | Resolution Owner | Target Phase |
|----|----------|--------|------------------|--------------|
| INT-Q1 | How should we handle API authentication securely? | Open | security-engineer | Phase 3 |
| INT-Q2 | What's the best approach for data transformation? | Open | backend-engineer | Phase 3 |
| INT-Q3 | How should we manage API rate limiting? | Open | backend-engineer | Phase 3 |

## Integration Type Constants

```typescript
export const INTEGRATION_TYPES = [
  "bank",
  "accounting",
  "travel",
  "payment",
  "ocr",
  "storage",
  "email",
  "analytics",
] as const;

export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_STATUSES = [
  "connected",
  "disconnected",
  "error",
  "pending",
] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];
```

## Provider Configuration Reference

### Banking (Plaid)

- **Provider**: `plaid`
- **Credentials**: `client_id`, `secret`, optional `mfa_code`
- **Test endpoint**: `convex/functions/bank-api.ts@testBankConnection`
- **Sync endpoint**: `convex/functions/bank-api.ts@syncBankAccounts`
- **Account fields**: `id`, `name`, `mask`, `type`, `balance`, `isoCurrencyCode`

### Accounting (QuickBooks/Xero/Wave)

- **Provider**: `quickbooks` | `xero` | `wave`
- **Credentials**: `company_id` | `access_token` | `access_token`
- **Test endpoint**: `convex/functions/accounting-api.ts@testAccountingConnection`
- **Sync endpoint**: `convex/functions/accounting-api.ts@syncAccountingTransactions`
- **Transaction fields**: `id`, `date`, `amount`, `description`, `payee`, `category`, `status`
- **Account fields**: `id`, `name`, `type`, `balance`

### Travel (Skyscanner/Expedia/Travelport)

- **Provider**: `skyscanner` | `expedia` | `travelport`
- **Credentials**: `api_key`
- **Test endpoint**: `convex/functions/travel-api.ts@testTravelConnection`
- **Sync endpoint**: `convex/functions/travel-api.ts@syncTravelData`
- **Flight fields**: `id`, `flightNumber`, `airline`, `origin`, `destination`, `departureDate`, `arrivalDate`, `price`, `currency`, `status`
- **Hotel fields**: `id`, `name`, `address`, `checkIn`, `checkOut`, `price`, `currency`, `status`

### General Integration Fields

| Field | Type | Description |
|-------|------|-------------|
| `orgId` | `string` | Organization scope |
| `type` | `IntegrationType` | Integration category |
| `provider` | `string` | Specific provider identifier |
| `name` | `string` | Display name |
| `config` | `any` | Provider-specific configuration |
| `credentials` | `any` | Encrypted credentials (client_id/secret, api_token, etc.) |
| `status` | `IntegrationStatus` | `pending` → `connected` → `error`/`disconnected` |
| `lastSyncAt` | `number \| null` | Timestamp of last sync |
| `errorMessage` | `string \| null` | Last sync error message |

## Sync Log Fields

| Field | Type | Description |
|-------|------|-------------|
| `orgId` | `string` | Organization scope |
| `integrationId` | `v.id("integrations")` | Linked integration |
| `status` | `SyncStatus` | `success`/`failed`/`partial` |
| `recordsProcessed` | `number` | Total records examined |
| `recordsCreated` | `number` | New records created |
| `recordsUpdated` | `number` | Existing records updated |
| `recordsSkipped` | `number` | Records skipped (duplicates, errors) |
| `errorMessage` | `string \| null` | Error details if failed |
| `startedAt` | `number` | Sync start timestamp |
| `completedAt` | `number \| null` | Sync completion timestamp |

## Webhook Event Fields

| Field | Type | Description |
|-------|------|-------------|
| `orgId` | `string` | Organization scope |
| `integrationId` | `v.id("integrations") \| null` | Linked integration |
| `provider` | `string` | Provider identifier |
| `eventType` | `string` | Event type (e.g., `transaction:synced`, `account:updated`) |
| `payload` | `any` | Raw event data from provider |
| `status` | `string` | `received`/`processed`/`failed` |
| `errorMessage` | `string \| null` | Error details if failed |
| `processedAt` | `number \| null` | Processing completion timestamp |
| `createdAt` | `number` | Event receipt timestamp |

## Security Controls

- **Auth requirement**: All integration operations require `requireAuthenticatedOrg`
- **Permission checks**: `integration:read`, `integration:create`, `integration:update`, `integration:delete`
- **Credential encryption**: Credentials stored in Convex DB with access controlled by org membership
- **Rate limiting**: Per-org rate limits on all integration API endpoints
- **Input validation**: All payloads validated via Convex `v` validator schema
- **CSRF protection**: Standard Convex auth guards prevent CSRF
- **Error sanitization**: Error messages stripped of sensitive data before client display

## Tech Spec Cross-References

- `` `tech-specs/backend/data-model.md` `` — Data model reference (orgId scoping, table indexes)
- `` `tech-specs/backend/api-contract.md` `` — API contract reference (endpoint patterns)
- `` `tech-specs/frontend/ui-spec.md` `` — Dashboard UI reference (component patterns)
- `` `spec-gaps.md` `` gap: `INT-Q1`, `INT-Q2`, `INT-Q3` — Open questions register
- `` `domains/01-auth/onboarding-auth.md` `` — Clerk JWT template config for org_id claim

## Decision Table (excerpt)

| Condition | Action |
|-----------|--------|
| `type` not in `INTEGRATION_TYPES` | Reject with `Invalid integration type` |
| `provider` already exists for `orgId` | Reject with `Provider already configured` |
| Missing required fields | Reject with `Missing required field: <field>` |
| `checkPermission` fails | Reject with `Insufficient permissions` |
| Sync fails after max retries | Log as `failed` in `integrationSyncLogs`, set `status: error` |

## Testing Pattern

New integration tests follow this pattern:

```typescript
// SEC-XXX: Finding description
it('REQUIRES <control> — <expected behaviour> (SEC-XXX)', async () => {
  // Arrange: vulnerable state
  // Act: trigger vulnerability
  // Assert: control blocks it
})
```

Test files named `<feature>.test.ts` or `<feature>-<control>.test.ts` placed in `__tests__/` alongside existing tests.

## Appendix: Provider Quickstart

### Plaid Banking Quickstart

1. Configure Clerk JWT template with `org_id` custom claim
2. Create Plaid developer account, obtain `client_id` and `secret`
3. Add integration via admin dashboard: type=bank, provider=plaid, name="My Bank"
4. Enter Plaid credentials in integration config
5. Click "Test Connection" — validates Plaid config
6. Click "Sync" — syncs accounts and transactions

### QuickBooks Quickstart

1. Configure Clerk JWT template with `org_id` custom claim
2. Create QuickBooks OAuth app, obtain `company_id` and `access_token`
3. Add integration via admin dashboard: type=accounting, provider=quickbooks, name="My Accounting"
4. Enter QuickBooks credentials in integration config
5. Click "Test Connection" — validates QuickBooks config
6. Click "Sync" — syncs transactions and accounts

### Skyscanner Quickstart

1. Configure Clerk JWT template with `org_id` custom claim
2. Obtain Skyscanner API key
3. Add integration via admin dashboard: type=travel, provider=skyscanner, name="Travel"
4. Enter Skyscanner API key in integration config
5. Click "Test Connection" — validates Skyscanner config
6. Click "Sync" — syncs flight and hotel data