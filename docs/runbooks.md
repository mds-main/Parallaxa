# Runbooks and incident response (TODO 25.6, 24.6)

Every action below can be taken from the admin console without a deploy, and every change is audit-logged with a reason.

## Reading the logs

Every server log line is one event in logfmt: level, event name, then fields. Search for any of them in the Vercel dashboard (Logs) or from a terminal with `vercel logs parallaxa1.vercel.app`.

```
error analysis.failed analysis=9f3c2a stage=investigate ms=41234 err="AiError(timeout): Request timed out" at=src/lib/ai/client.ts:212
```

- **Start from what you have.** A reader's "Error reference" is the `digest=` of a `request.failed` line. An analysis link `/a/<id>` gives `analysis=<id>`: that shows its run (`analysis.done` or `analysis.failed`), its model calls and its slots. An admin alert names the event to look for.
- **The same failure is written once a minute per instance.** The next line says how many were held back (`repeated=12`), so one line can stand for a burst.
- **Nothing personal is logged:** no reader text, claims, queries, emails or IP addresses. Fields with such names show `[redacted]`, and tokens, keys and database URLs are scrubbed from error messages. Use the admin console (Review, Metrics, Models) for content.
- **`LOG_LEVEL=debug`** (Vercel env var, then redeploy) adds routine cron runs, unreadable source pages and scrape fallbacks. Set it back to `info` afterwards.

| Event | Level | Meaning and first step |
|---|---|---|
| `request.failed` | error | Unhandled error in a page, API route or server action. `route`, `digest`, `at` (file and line) |
| `analysis.done` | info | One per finished check: `status` (published, review, needs_input), `ms`, `reused` |
| `analysis.failed` | error | A check failed: `stage` tells where. Look at the `model.*` / `search.*` lines just before it with the same `analysis=` |
| `analysis.stuck` | error | A check made no progress for 15 minutes (its function was cut off) and was marked failed by the health cron. `stage` tells where it stopped |
| `analysis.crashed` | error | The pipeline threw before it could record the failure (usually the database) |
| `slot.failed`, `shadow.failed` | warn | One perspective (or its shadow model) failed and abstained; the analysis went on |
| `model.call_failed` | warn | One try on one vendor failed: `err` has the class (timeout, rate_limit, auth, payment, server…) |
| `model.fallback_used` | warn | The backup vendor, or the Private backup model (Models › Supporting roles › Backup), answered. See *Venice outage* below |
| `model.circuit_open` | warn | A model failed too often and is being skipped for a while |
| `harness.checked` / `harness.sample_failed` | info / warn | Admin › Models "Test": the result for a slot and model / one of its 5 sample investigations failed |
| `model.all_routes_failed` | error | No vendor could answer: check keys (`auth`), credit (`payment`) or the vendor status page |
| `search.engine_failed` / `search.all_engines_failed` | warn / error | A search engine failed (the next one was used) / none worked. See *Search engine outage* |
| `research.plan_failed` | warn | The research planner failed; only the claim itself was searched |
| `embedding.failed` | warn | Similar-claim matching used the local fallback |
| `catalog.sync_failed`, `gateway.catalog_fetch_failed` | warn / error | Could not refresh the Venice or AI Gateway model list; the last one is kept |
| `health.slot_down` | warn | The 5-minute health ping failed for a perspective model |
| `cron.done` / `cron.failed` | info / error | One per job run with its counts (routine runs with nothing to do are `debug`) |
| `alert.raised` | warn | An admin alert, and whether Telegram took it |
| `telegram.rejected`, `telegram.gave_up` | error | Alerts are not reaching Telegram: check the token, the chat id and that the bot is in the chat |
| `auth.passkey_failed` / `auth.passkey_rejected` | warn / info | A passkey sign-up or sign-in failed. If `host` differs from `expected`, the reader is on another address than the production domain |
| `dialogue.failed` | error | "Push back" could not answer |
| `render.failed` | warn | An analysis could not be rendered in a language; the page showed the fallback |
| `config.edge_read_failed`, `config.edge_publish_failed` | warn / error | Edge Config unavailable; the configuration was read from the database |
| `db.*_insert_failed` | warn / error | A log or metrics row was not saved; the request itself went on |

## Venice outage or degradation
1. **Overview** shows "Backup provider: In use" and an alert is posted to the admins’ Telegram chat.
2. Check **Models**: circuit state per slot. If one model is failing, swap that slot (Test → Activate) or pause it with the circuit button.
3. If Venice is fully down, the AI Gateway backup keeps the Briefing and link checks running (disclosed on every analysis). Typed-text and screenshot checks, and Push back, carry the user's own words, so they only run on Venice's private models and pause until it recovers.
4. For a long or planned outage, switch vendors proactively: **Models → AI vendors → "AI Gateway, with Venice as backup"**, give a reason, type CONFIRM, apply. Live within about 10 seconds; switch back the same way.
5. If the backup is also failing: **Reliability & limits → Kill switches → Check** off, and set a maintenance banner in both languages.

## Search engine outage or poor results
1. Investigations fall back automatically: the primary engine, then each backup in order (Exa → Brave → Exa via Venice → Brave via Venice by default).
2. To switch for good: **Investigation → Search engines**, pick another primary (the old one becomes the first backup), give a reason, apply. Live within about 10 seconds.
3. For more varied sources on contested topics, turn on **Combine the primary and the first backup** (about twice the search cost).

## Spend spike
1. Alert at the configured percentage of the daily ceiling.
2. **Metrics → Costs**: find the step or slot driving cost.
3. Lower search and tool budgets (**Investigation**), switch slots to economy variants (**Models**, cost preview shown), or lower the ceiling (**Reliability & limits**).

## A wrong analysis goes viral
1. **Review queue**: open the error report or the analysis.
2. **Publish a correction** (new grade, confidence, reason in English and Spanish). It creates a new version with a public diff and appears in the corrections log and RSS feed within minutes.
3. If the error came from a model, consider a swap and check the post-swap eval on **Metrics**.

## Briefing late
1. Alert when an edition is not published by 06:45 local time.
2. **Review queue → Briefing edition**: approve, or publish fewer stories.

## Legal notice (rectification, defamation claim)
1. Do not delete anything. Unpublish the Ledger profile (**Ledger → Unpublish**) if the notice concerns it.
2. Forward to legal counsel the same day; the statutory rectification deadline (LO 2/1984) runs from receipt.
3. Publish the actor's reply (**Ledger → Publish a verified reply**) and any correction through the normal flow.

## Security incident (suspected admin compromise, data exposure)
1. Rotate `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` with `vercel env` and redeploy: this invalidates every admin session.
2. Review **Audit log** (export CSV) for unexpected changes and revert them from the log.
3. Restrict `/admin` with `ADMIN_IP_ALLOWLIST` and Firewall rules.
4. If personal data may be affected, notify the DPO; GDPR requires notifying the authority within 72 hours where applicable.

## A deploy fails at "[db]"
1. Nothing was changed in the database and the previous deployment is still live. Read the `[db]` lines in the build log; each failure says what to do.
2. Schema drift: run `pnpm db:generate`, commit the migration, push.
3. Unsafe migration: split it into two deploys (see `docs/deployment.md`, "Database migrations"), or, after review, add `-- parallaxa:allow-destructive <reason>` to the file.
4. "Database is busy" after all retries: redeploy at a quieter moment, or raise `MIGRATION_LOCK_TIMEOUT` for one deploy.
5. Preview blocked from the production database: give previews their own Neon branch, or merge to main.

## Rollback
- Configuration: **Models → Change history → Roll back**, or **Audit log → Revert**.
- Code: Vercel instant rollback to the previous production deployment (confirm first: it affects production). Migrations are additive by rule, so older code keeps working with the newer schema.
- Database (last resort): Neon point-in-time restore to the restore point printed in the build log, or the `pre-<migration>-<time>` backup branch.
