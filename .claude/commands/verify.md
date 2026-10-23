---
description: Run quality gates and audit acceptance criteria for the current phase
argument-hint: [phase number, optional]
---

Run the phase gate from the `quality-gates` skill for the current phase (or phase $ARGUMENTS if given; otherwise read it from `specs/progress.md`).

1. Run `pnpm verify`. Report each stage's result. If anything fails, diagnose root cause, fix with a test, re-run. Do not weaken tests or lint rules.
2. Run the relevant e2e specs and axe scans (light + dark). Report violations.
3. Audit every AC in the phase file: for each, state ✔/✘ with evidence (test name or screenshot path). For any ✘ or missing evidence, write the missing test or fix the gap.
4. Check for spec drift and update specs if reality legitimately changed (log in `specs/progress.md`).
5. Check `specs/open-questions.md` for BLOCKING items.
6. Finish with the reporting format: Done / Evidence / Not verified / Open questions / Next.
Be honest about anything you could not run.
