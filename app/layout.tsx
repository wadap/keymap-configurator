import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  title: 'Cornix / Keymap — キーボードを自分の配置に',
  description:
    'Vial対応キーボードの割り当てを読み込み、1キーずつ変更・適用・復元できるキーマップエディター。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
