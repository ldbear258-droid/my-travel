import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Travel｜把喜歡的地方收藏起來",
  description: "家庭共享旅遊收藏平台，可搜尋 Google Maps 店家並整理旅遊地點",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}