'use client';
import { ConfigEditor } from './ConfigEditor';
import { estimateInvestigationCost, type CatalogModel } from '@/lib/config/models';
import { estimateResearchCost } from '@/lib/ai/search-engines';
import type { AppConfig } from '@/lib/config/schema';

/** ConfigEditor with a live cost preview (per fresh analysis and per month at the current volume). */
export function EditorWithCost({ initial, catalog, monthlyAnalyses, children }: { initial: AppConfig; catalog: CatalogModel[]; monthlyAnalyses: number; children: React.ReactNode }) {
  const estimate = (c: AppConfig) => {
    const perAnalysis =
      c.slots.filter((s) => s.enabled).reduce((acc, s) => acc + estimateInvestigationCost(catalog.find((m) => m.id === s.model), s.harness), 0) +
      estimateResearchCost(c.search) + // research step: planned searches and page text
      0.03; // utility steps
    return { perAnalysis, perMonth: perAnalysis * Math.max(monthlyAnalyses, 1) };
  };
  return (
    <ConfigEditor initial={initial} costEstimate={estimate}>
      {children}
    </ConfigEditor>
  );
}
