# Cursor AI Rules — Setup Guide

A modular set of Cursor AI rules enforcing security, architecture alignment, testing standards, observability, resilience, data integrity, and performance awareness.

---

## File Structure

```
.cursorrules                          ← Root summary (Cursor always reads this)
.cursor/
  rules/
    security.mdc                      ← Secrets, auth, injection, secure defaults
    architecture-quality.mdc          ← Architecture alignment, DoD, YAGNI, dependencies
    testing.mdc                       ← Pareto-focused, risk-driven testing standards
    observability.mdc                 ← Logging, metrics, alertability, PII redaction
    resilience.mdc                    ← Timeouts, retries, circuit breakers, graceful degradation
    data-integrity.mdc                ← Migrations, backward compatibility, data loss prevention
    performance.mdc                   ← N+1, pagination, unbounded fetches, async patterns
    tracefield.mdc                    ← Tracefield-specific: provenance, feature contract, Kafka integrity, statistical validity
AGENT.md                              ← Feature module contract and API interaction patterns
docs/
  ARCHITECTURE.md                     ← System design, patterns, module boundaries
  NFR.md                              ← Performance, scalability, availability targets
  DECISIONS.md                        ← [YOU CREATE] Architecture Decision Records (ADRs)
  CONTRIBUTING.md                     ← [YOU CREATE] Code style, PR process, branching
```

---

## Installation

1. Copy `.cursorrules` to your project root.
2. Copy the `.cursor/` folder to your project root.
3. Your `AGENT.md`, `docs/ARCHITECTURE.md`, and `docs/NFR.md` are already in place — the rules reference them directly.
4. Create `docs/DECISIONS.md` (ADRs) and `docs/CONTRIBUTING.md` when ready — these are optional but improve Cursor alignment over time.

---

## Docs You Need to Create

The rules reference two key documents. Without them, Cursor can't align to your specific system.

### `docs/ARCHITECTURE.md` — Minimum contents:
- High-level system diagram or description
- Key modules/services and their responsibilities
- Patterns in use (e.g. repository pattern, event-driven, CQRS)
- What lives where (monorepo layout, service boundaries)
- What NOT to do (known anti-patterns for your codebase)

### `docs/NFR.md` — Minimum contents:
- Latency targets (e.g. p95 < 300ms for API responses)
- Scalability requirements (e.g. must handle 1000 concurrent users)
- Availability target (e.g. 99.9% uptime)
- Data retention and compliance requirements
- Observability standards (logging format, metrics platform)

---

## How the Rules Work

- `.cursorrules` is always loaded by Cursor as global context.
- `.cursor/rules/*.mdc` files are the modular detailed rules — Cursor loads these per session.
- `alwaysApply: true` in each `.mdc` file means they apply to all files, not just specific globs.

---

## Recommended Companion Tools

These rules are most effective when paired with automated enforcement:

| Purpose | Tool |
|---|---|
| Secret scanning | `gitleaks` or `truffleHog` (pre-commit hook) |
| SAST / static analysis | `semgrep`, `snyk`, or `bandit` (Python) |
| Dependency audit | `npm audit`, `pip-audit`, `trivy` |
| Linting | ESLint, Ruff, or your language equivalent |
| Formatting | Prettier, Black, or your language equivalent |
| Migration review | Manual PR review gate — no auto-apply |

---

## Principles Summary

| Area | Core Rule |
|---|---|
| Security | Never trust input. Never expose internals. Never hardcode secrets. |
| Architecture | Consistency over cleverness. Fit the existing system. |
| Testing | Test what matters. Skip what doesn't. Quality over coverage. |
| Observability | If it can fail silently, surface it. No PII in logs anywhere. |
| Resilience | One failing dependency should not take down the system. |
| Data Integrity | Migrations are irreversible. Backward compatibility is mandatory. |
| Performance | Flag N+1s, unbounded fetches, and blocking async operations at generation time. |
| Provenance | Every pipeline stage that produces data must emit a provenance_event. |
| Kafka Integrity | Idempotent consumers. Offset commits after writes. Dead-letter on exhaustion. |
| Statistical Validity | Never silently change tests, corrections, or effect size calculations. |
