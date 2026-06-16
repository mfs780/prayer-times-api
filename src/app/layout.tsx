import './globals.css';

export const metadata = {
  title: 'Prayer Times API',
  description: 'Multi-tenant prayer times + iqama API. Default tenant: ICCF.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
