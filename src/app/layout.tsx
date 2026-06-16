export const metadata = {
  title: 'prayer-times-api',
  description: 'Standalone prayer-times API service',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
