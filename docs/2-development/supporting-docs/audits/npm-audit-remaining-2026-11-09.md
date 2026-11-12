# npm audit — Remaining Moderate Vulnerabilities (Post-Fix)

Date: 2026-11-09
Status: 32 moderate/low vulnerabilities remain, all requiring `--force` (breaking changes)

---

## Summary

| Severity | Count | Blockers |
|----------|-------|----------|
| High | 0 | ✅ Fixed (node-forge) |
| Moderate | 23 | Require coordinated upgrades |
| Low | 9 | Minor |

---

## Remaining Moderate Vulnerabilities (23)

### 1. `deepmerge` — Prototype Pollution (GHSA-gcqx-w48m-w2h4)
- **Current**: ≥4.2.0 (transitive via `@rollup/plugin-node-resolve` → `nitropack` → `@nuxt/nitro-server` → `nuxt`)
- **Fix requires**: `resend@6.37.0` (breaking — v6.x changes API)
- **Impact**: Affects email sending via Resend

### 2. `glob` / `minimatch` — DoS / Traversal (GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249)
- **Current**: `glob` 9.0.0-14.0.1, `minimatch` 7.0.0-11.0.0
- **Transitive via**: `@vercel/nft` → `nitropack` → Nuxt; `eslint`/`typescript-eslint`/`@vue/test-utils` toolchain
- **Fix requires**: `@vue/test-utils@2.4.11` (breaking — v2.x API changes)
- **Impact**: Test utilities, ESLint config, Nuxt build pipeline

### 3. Transitive Chain Map

```
nuxt (4.6.x)
  ├── @nuxt/nitro-server
  │     └── nitropack
  │           ├── @rollup/plugin-node-resolve → deepmerge
  │           ├── @vercel/nft → glob → minimatch
  │           └── archiver → archiver-utils → glob → minimatch
  └── @nuxt/vite-builder
        └── nuxt (circular)

Toolchain:
  @nuxt/eslint-config
    ├── @typescript-eslint/* → minimatch
    ├── eslint → @eslint/config-array → minimatch
    ├── eslint-plugin-vue → @typescript-eslint/parser → minimatch
    └── @vue/test-utils (≥2.5.0) → js-beautify → glob → minimatch
```

---

## Upgrade Plan

### Phase 1: Resend v6 (unblocks `deepmerge`)
- [ ] Review `resend@6.x` migration guide
- [ ] Update email sending code in `convex/functions/email.ts`
- [ ] Test webhook/email flows
- [ ] Run `npm audit fix` again

### Phase 2: Vue Test Utils v2 (unblocks `glob`/`minimatch`)
- [ ] Review `@vue/test-utils@2.4.11` migration guide
- [ ] Update all component tests (`EntryList.test.ts`, `SettleUpModal.test.ts`, etc.)
- [ ] Update `@nuxt/eslint-config` if it pins old versions
- [ ] Run full test suite

### Phase 3: Nuxt 4.x / Nitro 3.x (may resolve transitives)
- [ ] Check if Nuxt 4.7+ / Nitro 3.x have resolved these transitives
- [ ] Coordinate with Convex/Nuxt compatibility

---

## Risk Assessment

| Upgrade | Risk | Mitigation |
|---------|------|------------|
| `resend@6.x` | Medium — API changes | Isolate email module; test webhook + send paths |
| `@vue/test-utils@2.x` | High — test API changes | Migrate incrementally; run component tests after each file |
| Nuct 4.7+ | Medium — framework changes | Test dev/build/deploy pipeline |

---

## Next Steps

1. **Do not run `npm audit fix --force`** until Phase 1 & 2 are planned
2. Create separate branches for each upgrade
3. Run full test matrix (177 tests + build + deploy check) per upgrade
4. Target: resolve all 32 within next sprint cycle

---

## Related Files to Update

- `convex/functions/email.ts` — Resend client usage
- `__tests__/components/*.test.ts` — Vue Test Utils patterns
- `package.json` — version pins
- `nuxt.config.ts` — if build plugins affected