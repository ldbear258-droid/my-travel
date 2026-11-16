import type { Metadata } from "next";

export const metadata: Metadata = { title: "使用條款｜My Travel" };

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <a href="/">← 返回 My Travel</a>
      <h1>My Travel 使用條款</h1>
      <p>最後更新：2026 年 11 月 16 日</p>
      <h2>服務用途</h2>
      <p>My Travel 是提供家庭成員整理私人旅遊收藏的工具。只有經管理者建立並加入家庭空間的帳號可以登入及存取共同資料。</p>
      <h2>使用者責任</h2>
      <p>使用者應妥善保管登入資訊，只新增自己有權使用或分享的文字、照片、連結及備註。家庭成員可以共同檢視、新增、修改及刪除家庭收藏。</p>
      <h2>Google Maps 內容</h2>
      <p>店家搜尋由 Google Maps Platform Places API 提供。搜尋結果只在查詢時即時顯示；My Travel 僅保存 Google Place ID，使用者自行輸入的收藏名稱、地址及備註則由使用者管理。Google Maps 內容仍受 Google Maps Platform 服務條款及政策約束。</p>
      <p><a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noreferrer">Google Maps Platform Terms of Service</a></p>
      <h2>第三方服務</h2>
      <p>本服務使用 Supabase 提供登入、資料庫及圖片儲存，並使用 Vercel 提供網站託管。第三方服務依其各自條款提供。</p>
      <h2>服務變更與資料</h2>
      <p>管理者可維護家庭成員帳號及家庭資料。請勿將 My Travel 當作唯一備份；重要照片與資料請另行備份。</p>
      <h2>聯絡方式</h2>
      <p>本版本為家庭自用服務。如需修正條款或處理家庭資料，請聯絡 My Travel 家庭管理者。</p>
      <p><a href="/privacy">查看隱私權政策</a></p>
    </main>
  );
}
