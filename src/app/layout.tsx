import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ポーカープレーログ",
  description: "ライブポーカーのセッション・プレイヤー・ゲームを高速記録するPWA",
  applicationName: "ポーカープレーログ",
  appleWebApp: {
    capable: true,
    title: "ポーカープレーログ",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
