# Runbooks and incident response (TODO 25.6, 24.6)

Every action below can be taken from the admin console without a deploy, and every change is audit-logged with a reason.

## Venice outage or degradation
1. **Overview** shows "Backup provider: In use" and an alert is emailed.
2. Check **Models**: circuit state per slot. If one model is failing, swap that slot (Test → Activate) or pause it with the circuit button.
3. If Venice is fully down, the AI Gateway fallback keeps Check and Briefing running (disclosed on every analysis). Push back pauses automatically.
4. If the fallback is also failing: **Reliability & limits → Kill switches → Check** off, and set a maintenance banner in both languages.

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

## Rollback
- Configuration: **Models → Change history → Roll back**, or **Audit log → Revert**.
- Code: Vercel instant rollback to the previous production deployment (confirm first: it affects production).
