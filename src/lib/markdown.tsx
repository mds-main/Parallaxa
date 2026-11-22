/**
 * Minimal Markdown renderer for our own trusted documents (methodology/*.md): headings, paragraphs,
 * lists, tables, bold, italics, links. Produces React elements, never raw HTML.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCALE } from '@/i18n/languages';
import React from 'react';

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) out.push(<em key={`${key}-${i++}`}>{tok.slice(1, -1)}</em>);
    else {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      const safe = /^(https?:|\/|#)/.test(href!) ? href : '#';
      out.push(<a key={`${key}-${i++}`} href={safe} rel="noopener noreferrer">{label}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1]!.length;
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={k++} className={level === 1 ? 'text-3xl font-semibold' : level === 2 ? 'mt-8 text-xl font-semibold' : 'mt-6 font-semibold'}>{inline(h[2]!, `h${k}`)}</Tag>);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith('|')) {
        const cells = lines[i]!.split('|').slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={k++} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr>{head!.map((c, j) => <th key={j} className="border-b border-line p-2 text-left">{inline(c, `th${k}${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border-b border-line p-2 align-top">{inline(c, `td${k}${ri}${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^(-|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^(-|\d+\.)\s/.test(lines[i]!)) items.push(lines[i++]!.replace(/^(-|\d+\.)\s/, ''));
      const L = ordered ? 'ol' : 'ul';
      blocks.push(React.createElement(L, { key: k++, className: `my-3 space-y-1.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}` }, items.map((it, j) => <li key={j}>{inline(it, `li${k}${j}`)}</li>)));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#|\||-\s|\d+\.\s)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push(<p key={k++} className="my-3 leading-relaxed">{inline(para.join(' '), `p${k}`)}</p>);
  }
  return <>{blocks}</>;
}

export function loadDoc(folder: 'methodology', name: string, lang: string): string | null {
  if (!/^[a-z-]+$/.test(name)) return null;
  for (const l of [lang, DEFAULT_LOCALE]) {
    const f = path.join(process.cwd(), folder, l, `${name}.md`);
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  }
  return null;
}
