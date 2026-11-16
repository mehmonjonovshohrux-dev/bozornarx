import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface R {
  id: string;
  parentId: string | null;
}

/** The region tree is small (viloyat > tuman > shahar), so it is cached in memory for a minute. */
@Injectable()
export class RegionsService {
  private cache: { at: number; rows: R[] } | null = null;
  constructor(private readonly prisma: PrismaService) {}

  private async rows(): Promise<R[]> {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache.rows;
    const rows = await this.prisma.region.findMany({ select: { id: true, parentId: true } });
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  /** The region itself plus every descendant. Filtering by a viloyat includes its tumans. */
  async withDescendants(regionId: string): Promise<string[]> {
    const rows = await this.rows();
    const out = new Set<string>([regionId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const r of rows) if (r.parentId && out.has(r.parentId) && !out.has(r.id)) { out.add(r.id); grew = true; }
    }
    return [...out];
  }

  invalidate(): void {
    this.cache = null;
  }
}
