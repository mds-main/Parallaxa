/**
 * The Telegram bot that posts admin alerts (adapted from Tokentide's ops alerts). Admins are never emailed.
 *
 * - `TELEGRAM_BOT_TOKEN`: the token BotFather gave for the bot.
 * - `TELEGRAM_CHAT_ID`: where it posts: a person's numeric id, a group's negative id, or `@channel` for a channel
 *   the bot administers. Several, comma-separated, each get every message. A person must message the bot first
 *   (or add it to the group) before it can post there; `pnpm telegram --find-chats` lists the ids.
 *
 * Until both are set nothing is sent. Messages are Telegram HTML with every value escaped, within the
 * 4096-character limit. Rate limits, server errors and lost connections are retried briefly, a group upgraded
 * to a supergroup is followed, and HTML Telegram cannot parse is resent as plain text. Nothing here throws, and
 * the token (part of every request URL) never reaches a log line.
 */

const API = 'https://api.telegram.org';

/** Telegram's limit for one message, in UTF-16 code units. */
export const MESSAGE_LIMIT = 4096;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_MS = 5_000;
const REQUEST_TIMEOUT_MS = 5_000;
const TRUNCATION_MARKER = ' […]';

export type TelegramMessage = {
  /** Telegram HTML; every value in it escaped with `escapeHtml`. */
  html: string;
  /** Delivered without a sound. */
  silent?: boolean;
};

type TelegramReply = { ok?: boolean; description?: string; parameters?: { retry_after?: number; migrate_to_chat_id?: number } };

/** The configured chats, in order, without blanks or repeats. */
export function telegramChats(): string[] {
  const chats: string[] = [];
  for (const part of (process.env.TELEGRAM_CHAT_ID ?? '').split(/[,;]/)) {
    const chat = part.trim();
    if (chat && !chats.includes(chat)) chats.push(chat);
  }
  return chats;
}

export function telegramConfigured(): boolean {
  return Boolean((process.env.TELEGRAM_BOT_TOKEN ?? '').trim()) && telegramChats().length > 0;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `text` shortened with a marker to at most `limit` UTF-16 code units, never splitting a surrogate pair. */
export function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let cut = limit - TRUNCATION_MARKER.length;
  if (/[\uD800-\uDBFF]/.test(text.charAt(cut - 1))) cut -= 1;
  return text.slice(0, cut).trimEnd() + TRUNCATION_MARKER;
}

/** The text of a message without its markup, for when Telegram cannot take the HTML. */
export function toPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function sendToChat(token: string, chat: string, message: TelegramMessage): Promise<boolean> {
  let payload: Record<string, unknown> = {
    chat_id: chat,
    link_preview_options: { is_disabled: true },
    ...(message.silent ? { disable_notification: true } : {}),
    ...(message.html.length <= MESSAGE_LIMIT ? { text: message.html, parse_mode: 'HTML' } : { text: clip(toPlainText(message.html), MESSAGE_LIMIT) }),
  };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let wait: number;
    try {
      const res = await fetch(`${API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const reply = (await res.json().catch(() => ({}))) as TelegramReply;
      if (res.ok && reply.ok) return true;
      const migrated = reply.parameters?.migrate_to_chat_id;
      if (migrated !== undefined) {
        // The group became a supergroup with a new id: post there (TELEGRAM_CHAT_ID should be updated).
        console.warn('telegram: chat migrated to a supergroup; update TELEGRAM_CHAT_ID');
        payload = { ...payload, chat_id: migrated };
        continue;
      }
      if (res.status === 400 && 'parse_mode' in payload && /can't parse entities/i.test(reply.description ?? '')) {
        const { parse_mode: _p, ...rest } = payload;
        void _p;
        payload = { ...rest, text: clip(toPlainText(message.html), MESSAGE_LIMIT) };
        continue;
      }
      if (res.status === 429) {
        const seconds = Number(reply.parameters?.retry_after ?? 1);
        wait = Math.min(Math.max(Number.isFinite(seconds) ? seconds : 1, 0) * 1000, MAX_RETRY_AFTER_MS);
      } else if (res.status >= 500) {
        wait = 1000 * attempt;
      } else {
        // Wrong token or chat, or the bot was blocked or removed: retrying won't help.
        console.error(`telegram: rejected (HTTP ${res.status})`);
        return false;
      }
    } catch {
      // Lost connection or timeout. The error text can quote the request URL, which holds the token: never log it.
      wait = 1000 * attempt;
    }
    if (attempt < MAX_ATTEMPTS) await sleep(wait);
  }
  console.error('telegram: gave up after retries');
  return false;
}

/** Posts `message` to every configured chat. Returns how many accepted it (0 when not configured). */
export async function sendTelegram(message: TelegramMessage): Promise<number> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  const chats = telegramChats();
  if (!token || chats.length === 0) return 0;
  const delivered = await Promise.all(chats.map((chat) => sendToChat(token, chat, message).catch(() => false)));
  return delivered.filter(Boolean).length;
}
