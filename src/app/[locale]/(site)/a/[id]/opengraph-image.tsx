import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { getAnalysis } from '@/lib/queries';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Share card in the sharer's language: claim + evidence grade, never a "FALSE" stamp over anyone (PRD F4). */
export default async function OgImage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  const found = await getAnalysis(id);
  const published = found?.analysis.status === 'published';
  const claim = published ? (found!.claim?.canonicalText ?? '') : '';
  const grade = published && found!.analysis.grade ? t(`grades.${found!.analysis.grade}`) : '';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f7f5f0', color: '#1c1f24', padding: 64, fontFamily: 'Georgia, serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36 }}>
          <div style={{ display: 'flex', position: 'relative', width: 70, height: 48 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 48, height: 48, borderRadius: 24, border: '5px solid #1c1f24' }} />
            <div style={{ position: 'absolute', left: 22, top: 0, width: 48, height: 48, borderRadius: 24, border: '5px solid #c98a1b' }} />
          </div>
          Parallaxa
        </div>
        <div style={{ display: 'flex', fontSize: claim.length > 140 ? 40 : 52, lineHeight: 1.25 }}>{claim ? `“${claim.slice(0, 220)}”` : t('tagline')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34 }}>
          {grade && <div style={{ display: 'flex', padding: '10px 26px', borderRadius: 999, border: '2px solid #1c1f24', background: '#efebe3' }}>{grade}</div>}
          <div style={{ display: 'flex', color: '#6b7078', fontSize: 26 }}>{t('tagline')}</div>
        </div>
      </div>
    ),
    size,
  );
}
