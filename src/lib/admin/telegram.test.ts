import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clip, escapeHtml, sendTelegram, telegramChats, telegramConfigured } from './telegram';
import { formatAlert } from './alerts';

const TOKEN = '123456:secret-test-token';
type Sent = { url: string; body: Record<string, unknown> };

describe('Telegram admin alerts', () => {
  const sent: Sent[] = [];
  let replies: { status: number; body: unknown }[] = [];
  const logs: string[] = [];
  beforeEach(() => {
    sent.length = 0;
    logs.length = 0;
    replies = [];
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_CHAT_ID = '-1001, 42, -1001';
    vi.spyOn(console, 'error').mockImplementation((...a) => void logs.push(a.join(' ')));
    vi.spyOn(console, 'warn').mockImplementation((...a) => void logs.push(a.join(' ')));
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      const r = replies.shift() ?? { status: 200, body: { ok: true } };
      return new Response(JSON.stringify(r.body), { status: r.status });
    });
  });
  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts to every configured chat once', async () => {
    expect(telegramChats()).toEqual(['-1001', '42']);
    expect(await sendTelegram({ html: '<b>hi</b>' })).toBe(2);
    expect(sent.map((s) => s.body.chat_id).sort()).toEqual(['-1001', '42']);
    expect(sent[0]!.body).toMatchObject({ parse_mode: 'HTML', text: '<b>hi</b>' });
  });

  it('sends nothing until both variables are set', async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    expect(telegramConfigured()).toBe(false);
    expect(await sendTelegram({ html: 'x' })).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('retries a rate limit, follows a migrated group, and falls back to plain text', async () => {
    process.env.TELEGRAM_CHAT_ID = '-1001';
    replies = [{ status: 429, body: { ok: false, parameters: { retry_after: 0 } } }];
    expect(await sendTelegram({ html: 'x' })).toBe(1);
    expect(sent).toHaveLength(2);
    sent.length = 0;
    replies = [
      { status: 400, body: { ok: false, parameters: { migrate_to_chat_id: -1009 } } },
      { status: 400, body: { ok: false, description: "Bad Request: can't parse entities" } },
    ];
    expect(await sendTelegram({ html: '<b>a &amp; b</b>' })).toBe(1);
    const last = sent.at(-1)!.body;
    expect(last.chat_id).toBe(-1009);
    expect(last.parse_mode).toBeUndefined();
    expect(last.text).toBe('a & b');
  });

  it('never writes the token to logs when Telegram rejects the bot', async () => {
    process.env.TELEGRAM_CHAT_ID = '42';
    replies = [{ status: 401, body: { ok: false, description: 'Unauthorized' } }];
    expect(await sendTelegram({ html: 'x' })).toBe(0);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  it('formats alerts for a phone, with every value escaped and a console link', () => {
    const html = formatAlert('spend', 'Spend is <$120> of $150 & rising', 'https://parallaxa.example');
    expect(html).toContain('💸 <b>AI spend is near the daily ceiling</b>');
    expect(html).toContain('Spend is &lt;$120&gt; of $150 &amp; rising');
    expect(html).toContain('href="https://parallaxa.example/en/admin/metrics"');
    expect(escapeHtml('"<x>"')).toBe('&quot;&lt;x&gt;&quot;');
    expect(clip('a'.repeat(10), 8)).toBe('aaaa […]');
  });
});
