import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Travel｜把喜歡的地方收藏起來",
  description: "個人旅遊收藏與行程管理平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}