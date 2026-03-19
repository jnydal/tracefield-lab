# Tracefield Lab — guidance for Claude Code and AI agents

This file gives **Claude Code** (and similar tools) the same handoff context that Cursor gets from `.cursor/rules`. Read it at session start; then use the linked docs as the source of truth.

## Read first (in order)

| Document | Purpose |
|----------|---------|
| [AGENT.md](AGENT.md) | API examples, feature module contract, new-service checklist, integration tests |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, services, data flow, **Kafka pipeline integrity** |
| [NFR.md](NFR.md) | PII, retention, licensing, statistical rigor, observability fields |
| [docs/INVARIANTS.md](docs/INVARIANTS.md) | Pipeline invariants, provenance, `GET /invariants` |
| [RUNBOOK.md](RUNBOOK.md) | Operations, troubleshooting, local/CI test commands |

## Cursor rules (optional skim)

`.cursor/rules/*.mdc` are tuned for **Cursor** and are not auto-loaded by Claude Code. Domain-specific expectations are mirrored in the docs above; for a compact checklist, open `.cursor/rules/tracefield.mdc`.

## Non-negotiables (short)

- **Invariants:** Changing pipeline stages or schema must preserve [docs/INVARIANTS.md](docs/INVARIANTS.md); CI runs `test/invariants/`.
- **Provenance:** Stages that produce or transform data must emit audit records; minimum fields are described in INVARIANTS and NFR.
- **Feature modules:** Namespaced `feature_name`, standard schema, provenance on outputs — see AGENT.md **Module Contract**.
- **Kafka workers:** Idempotent processing, commit offsets only after successful writes, handle producer failures, update job status — see ARCHITECTURE.md **Kafka Pipeline Integrity**.
- **Statistics:** Do not silently change tests, corrections, effect sizes, or default parameters; see NFR.md **Reproducibility & Scientific Validity**.
- **PII:** No real personal data in seeds, fixtures, migrations, or comments; use placeholders — see NFR.md **Data Governance**.

## Superpowers / TDD vs this repo’s testing philosophy

Workflows like [Superpowers](https://github.com/obra/superpowers) often push strict red–green TDD on every change. **Tracefield** uses **risk-focused testing** (Pareto): prioritize business logic, validation, auth, integrations, and high blast-radius paths; avoid coverage theater. Use strict TDD **where risk is highest**; for trivial or well-covered library glue, follow project judgment. Details: `.cursor/rules/testing.mdc` (same intent as project testing rules).

## Definition of done

- Behavior matches **ARCHITECTURE.md** and does not weaken **NFR.md**.
- Pipeline/schema changes preserve **INVARIANTS.md** and pass invariant checks.
- Update **AGENT.md**, **RUNBOOK.md**, **README.md**, or **ARCHITECTURE.md** when APIs, ops, or architecture change.
- Add or adjust tests for changed critical paths (see testing section above).
