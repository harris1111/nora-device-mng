/**
 * In-process pub/sub for SSE notification streams.
 * Maps userId -> Set<Response>; broadcasting writes an SSE event to each
 * connected client. Process-local only (single-instance deployment).
 */
import type { Response } from 'express';

type Subscribers = Map<string, Set<Response>>;

const subscribers: Subscribers = new Map();

export function subscribe(userId: string, res: Response): () => void {
  let set = subscribers.get(userId);
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(res);
  return () => {
    const s = subscribers.get(userId);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) subscribers.delete(userId);
  };
}

function send(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    // client closed; cleanup happens via subscription unsub on close
  }
}

export function publishToUser(userId: string, event: string, data: unknown): void {
  const set = subscribers.get(userId);
  if (!set) return;
  for (const res of set) send(res, event, data);
}

export function publishToAll(event: string, data: unknown): void {
  for (const set of subscribers.values()) {
    for (const res of set) send(res, event, data);
  }
}

export function heartbeatAll(): void {
  for (const set of subscribers.values()) {
    for (const res of set) {
      try { res.write(': ping\n\n'); } catch { /* ignore */ }
    }
  }
}
