import Link from 'next/link';

export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', padding: '3rem', background: '#f7f5f0', color: '#1c1f24' }}>
        <p>Page not found. <Link href="/">Parallaxa</Link></p>
      </body>
    </html>
  );
}
