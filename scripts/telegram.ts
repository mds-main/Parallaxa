/**
 * Checks the Telegram bot that posts admin alerts (src/lib/admin/telegram.ts). Adapted from Tokentide.
 *
 *   pnpm telegram --check        # the token works and chats are set
 *   pnpm telegram --find-chats   # ids of chats that messaged the bot (or added it) in the last 24 h
 *   pnpm telegram --test         # post a test alert to every chat
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (several chats comma-separated) from the environment, e.g.
 *   TELEGRAM_BOT_TOKEN=… pnpm telegram --find-chats
 * The token is never printed: errors that could quote the request URL are redacted first.
 */
const API = 'https://api.telegram.org';
const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
const chats = [...new Set((process.env.TELEGRAM_CHAT_ID ?? '').split(/[,;]/).map((c) => c.trim()).filter(Boolean))];
const redact = (text: unknown) => (token ? String(text).split(token).join('<TELEGRAM_BOT_TOKEN>') : String(text));

type Chat = { id: number | string; type?: string; title?: string; first_name?: string; last_name?: string; username?: string };

async function call<T>(method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new Error(redact(err instanceof Error ? err.message : err));
  }
  const reply = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || !reply.ok) throw new Error(redact(`HTTP ${res.status}: ${reply.description ?? 'no description'}`));
  return reply.result as T;
}

async function findChats() {
  const found = new Map<string, { id: string; type: string; name: string }>();
  for (const update of (await call<Record<string, { chat?: Chat }>[]>('getUpdates')) ?? []) {
    for (const key of ['message', 'channel_post', 'my_chat_member']) {
      const chat = update[key]?.chat;
      if (!chat || chat.id === undefined) continue;
      const name = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ') + (chat.username ? ` (@${chat.username})` : '');
      found.set(String(chat.id), { id: String(chat.id), type: chat.type ?? '', name });
    }
  }
  return [...found.values()];
}

async function main(): Promise<number> {
  const mode = process.argv[2] ?? '--check';
  if (!['--check', '--find-chats', '--test'].includes(mode)) {
    console.error('Usage: pnpm telegram [--check | --find-chats | --test]');
    return 2;
  }
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set.');
    return 2;
  }
  let bot: { username: string; first_name: string };
  try {
    bot = await call('getMe');
  } catch (err) {
    console.error(`The bot token does not work: ${(err as Error).message}`);
    return 1;
  }
  console.log(`Bot: @${bot.username} (${bot.first_name})`);

  if (mode === '--find-chats') {
    const found = await findChats().catch((err: Error) => {
      console.error(`Could not read the bot's updates: ${err.message}`);
      return null;
    });
    if (!found) return 1;
    if (!found.length) {
      console.log('No chats yet. Send the bot a message in Telegram (or add it to a group), then run this again.');
      return 1;
    }
    for (const chat of found) console.log(`${chat.id.padStart(16)}  ${chat.type.padEnd(10)}  ${chat.name}`);
    console.log('Set TELEGRAM_CHAT_ID to the id of the chat that should get the alerts.');
    return 0;
  }

  console.log(`TELEGRAM_CHAT_ID: ${chats.length ? chats.join(', ') : 'not set'}`);
  if (!chats.length) {
    console.log('No alerts are sent until TELEGRAM_CHAT_ID is set. Find the id with --find-chats.');
    return mode === '--test' ? 2 : 0;
  }
  if (mode !== '--test') return 0;
  let delivered = 0;
  for (const chat of chats) {
    try {
      await call('sendMessage', { chat_id: chat, parse_mode: 'HTML', text: '✅ <b>Parallaxa alerts are connected</b>\n\nThis chat will receive admin alerts.\n\n<i>test</i>' });
      delivered += 1;
    } catch (err) {
      console.error(`Chat ${chat}: ${(err as Error).message}`);
    }
  }
  console.log(`Test alert delivered to ${delivered} of ${chats.length} chat(s).`);
  return delivered === chats.length ? 0 : 1;
}

main().then((code) => {
  process.exitCode = code;
});
