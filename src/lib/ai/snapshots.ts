import { createHash } from 'node:crypto';
import { getDb } from '../db/client';
import { sourceSnapshots } from '../db/schema';

const MAX = 200_000;

/** Stores a private text snapshot of a fetched page and returns its content hash. Never throws. */
export async function saveSnapshot(url: string, title: string, text: string): Promise<string | null> {
  try {
    const body = text.slice(0, MAX);
    const hash = createHash('sha256').update(body).digest('hex');
    const db = await getDb();
    await db.insert(sourceSnapshots).values({ hash, url, title: title.slice(0, 300), text: body }).onConflictDoNothing();
    return hash;
  } catch {
    return null;
  }
}
