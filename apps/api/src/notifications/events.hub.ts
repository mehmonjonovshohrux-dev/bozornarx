import { Injectable } from '@nestjs/common';
import type { Response } from 'express';

/**
 * In-memory fan-out of real-time events (chat messages, notifications) to open streams of a user.
 * Single API instance only. With several instances, replace the map with Redis pub/sub (same interface).
 */
@Injectable()
export class EventsHub {
  private readonly streams = new Map<string, Set<Response>>();

  add(userId: string, res: Response): () => void {
    let set = this.streams.get(userId);
    if (!set) {
      set = new Set();
      this.streams.set(userId, set);
    }
    set.add(res);
    return () => {
      set.delete(res);
      if (set.size === 0) this.streams.delete(userId);
    };
  }

  emit(userId: string, event: string, data: unknown): void {
    const set = this.streams.get(userId);
    if (!set) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) res.write(frame);
  }

  online(userId: string): boolean {
    return this.streams.has(userId);
  }
}
