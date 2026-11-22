import { describe, expect, it } from 'vitest';
import { activateConfig, getActiveConfig, listConfigVersions, rollbackTo } from './store';
import { listAudit } from '../admin/audit';

describe('config store', () => {
  it('activates a new version, audits it and rolls back', async () => {
    const first = await getActiveConfig();
    const next = structuredClone(first.config);
    next.slots[2]!.model = 'kimi-k3';
    const res = await activateConfig(next, { reason: 'Swap CN to Kimi' });
    expect(res.ok).toBe(true);
    const now = await getActiveConfig();
    expect(now.config.slots[2]!.model).toBe('kimi-k3');
    expect((await listAudit())[0]!.action).toBe('config.activate');

    const back = await rollbackTo(first.id, { reason: 'test' });
    expect(back.ok).toBe(true);
    expect((await getActiveConfig()).config.slots[2]!.model).toBe('deepseek-v4-pro');
    expect((await listConfigVersions()).filter((v) => v.status === 'active')).toHaveLength(1);
  });

  it('refuses a lineup that breaks the rules or has no reason', async () => {
    const c = structuredClone((await getActiveConfig()).config);
    c.slots[1]!.enabled = false;
    const r = await activateConfig(c, { reason: 'x' });
    expect(r.ok).toBe(false);
    const r2 = await activateConfig((await getActiveConfig()).config, { reason: '  ' });
    expect(r2.ok).toBe(false);
  });
});
