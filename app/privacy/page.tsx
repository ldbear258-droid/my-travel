import type { Metadata } from "next";

export const metadata: Metadata = { title: "隱私權政策｜My Travel" };

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <a href="/">← 返回 My Travel</a>
      <h1>My Travel 隱私權政策</h1>
      <p>最後更新：2026 年 11 月 16 日</p>
      <h2>我們處理的資料</h2>
      <p>為提供家庭旅遊收藏功能，My Travel 會處理登入 Email、使用者自行新增的旅行名稱、收藏名稱、地區、地址、備註、貼文連結及上傳圖片，以及用於連結 Google Maps 地點的 Place ID。</p>
      <h2>Google Maps 搜尋</h2>
      <p>當使用者主動搜尋店家時，搜尋文字會傳送至 Google Maps Platform Places API，以回傳即時搜尋結果。My Travel 不會把 Google Places 回傳的店家名稱或地址複製保存到資料庫；只保存 Google Place ID。搜尋結果依 Google Maps Platform 政策顯示並附上 Google Maps 來源標示。</p>
      <p><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> · <a href="https://developers.google.com/maps/documentation/places/web-service/policies" target="_blank" rel="noreferrer">Google Maps Platform Places API Policies</a></p>
      <h2>資料用途與分享範圍</h2>
      <p>家庭資料僅供已加入同一家庭空間的登入成員共同檢視、建立、修改及刪除。My Travel 不提供公開註冊或公開瀏覽家庭收藏。</p>
      <h2>資料服務提供者</h2>
      <p>登入、資料庫及圖片儲存由 Supabase 提供；網站託管由 Vercel 提供。Google Maps 搜尋由 Google Maps Platform 提供。各服務依其政策處理相關技術資料。</p>
      <h2>資料保留與安全</h2>
      <p>家庭收藏在使用者或管理者刪除前保留。系統使用登入驗證及資料列存取政策限制家庭資料。請使用者妥善保管密碼，並避免上傳不應與家庭成員分享的敏感資料。</p>
      <h2>政策更新</h2>
      <p>本政策可能隨功能調整而更新，更新日期會顯示於本頁。</p>
      <p><a href="/terms">查看使用條款</a></p>
    </main>
  );
}
