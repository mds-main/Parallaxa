// The <html> element lives in app/[locale]/layout.tsx so it can carry the right lang and dir.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
