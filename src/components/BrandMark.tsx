/**
 * The Parallax Lens: two woven rings (two viewpoints), the lit lens they share, and the star both can see.
 * Same drawing as scripts/generate-icons.ts. The left ring follows the text colour, so it works in light and dark themes.
 */
const LENS = 'M32 18.73A15 15 0 0 1 32 45.27A15 15 0 0 1 32 18.73Z';
const STAR = 'M32 25Q32.9 31.1 39 32Q32.9 32.9 32 39Q31.1 32.9 25 32Q31.1 31.1 32 25Z';

export function BrandMark({ height = 28, id = 'plx', className }: { height?: number; id?: string; className?: string }) {
  const width = Math.round((height * 50) / 36);
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg width={width} height={height} viewBox="7 14 50 36" aria-hidden="true" focusable="false" className={className}>
      <defs>
        <linearGradient id={`${id}-lens`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE7AE" />
          <stop offset=".5" stopColor="#E7AC45" />
          <stop offset="1" stopColor="#9A640C" />
        </linearGradient>
        <linearGradient id={`${id}-rb`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E7AC45" />
          <stop offset="1" stopColor="#A36B0C" />
        </linearGradient>
        <clipPath id={`${id}-top`}>
          <circle cx="32" cy="18.73" r="6" />
        </clipPath>
        <clipPath id={`${id}-bot`}>
          <circle cx="32" cy="45.27" r="6" />
        </clipPath>
        <mask id={`${id}-ma`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <circle cx="25" cy="32" r="15" fill="none" stroke="#fff" strokeWidth="4" />
        </mask>
        <mask id={`${id}-mb`} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <circle cx="39" cy="32" r="15" fill="none" stroke="#fff" strokeWidth="4" />
        </mask>
      </defs>
      <path d={LENS} fill={ref('lens')} />
      <circle cx="25" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="3.4" />
      <circle cx="39" cy="32" r="15" fill="none" stroke="var(--paper)" strokeWidth="7.2" clipPath={ref('bot')} mask={ref('ma')} />
      <circle cx="39" cy="32" r="15" fill="none" stroke={ref('rb')} strokeWidth="3.4" />
      <circle cx="25" cy="32" r="15" fill="none" stroke="var(--paper)" strokeWidth="7.2" clipPath={ref('top')} mask={ref('mb')} />
      <circle cx="25" cy="32" r="15" fill="none" stroke="currentColor" strokeWidth="3.4" clipPath={ref('top')} />
      <path d={STAR} fill="#FFFDF5" />
    </svg>
  );
}

/** The app name with its "x" in the accent colour: where two lines of sight cross. Screen readers get the plain name. */
export function Wordmark({ name }: { name: string }) {
  const i = name.toLowerCase().lastIndexOf('x');
  if (i < 0) return <>{name}</>;
  return (
    <>
      <span aria-hidden="true">
        {name.slice(0, i)}
        <span className="text-accent-ink">{name[i]}</span>
        {name.slice(i + 1)}
      </span>
      <span className="sr-only">{name}</span>
    </>
  );
}
