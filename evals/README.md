# Evaluation

- `gold-set.json` is a **seed** gold set (stable, uncontroversial facts plus symmetric mirror pairs and Spanish variants) used by the harness check, the post-swap eval and the nightly regression. The production gold set (≥ 1,000 claims graded by fact-checkers of different orientations, TODO 3.12) replaces it in Phase 0/1.
- `baseline.json` holds the release-gate thresholds. `pnpm eval` fails if accuracy drops more than 1 point below the baseline, or any parity metric falls below tolerance.
- `mirrorOf` links a claim to its mirror; both must get the same grade when the evidence is equivalent (parity ±0.1).
- `variantOf` links a translation to its original; the grade must match (language parity).
