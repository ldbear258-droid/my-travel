## My Travel V1

家庭私人版繁體中文旅遊收藏管理 Web App。全家共用一組登入帳號，收藏資料集中在同一個家庭空間；不提供公開註冊。支援建立旅行專案、收藏地點、上傳照片、搜尋與初步重複提醒。

### 目前版本
- Email 登入、登出（Supabase Auth）；不開放公開註冊，由管理者建立家庭共用帳號
- 新增旅行專案及地點收藏
- 收藏欄位：地點名稱、國家、城市、區域、分類、地址、原始貼文網址、備註及圖片
- 搜尋收藏及依旅行專案篩選
- 初步重複提醒
- Supabase Row Level Security，使用者只能讀寫自己的資料
- 圖片儲存在 private Storage bucket

### 尚未完成（後續版本）
- 手機分享選單直接傳入 My Travel
- AI 自動讀取社群貼文並辨識地點
- 地圖顯示／定位
- 每日行程編排與拖曳排序
- 公開分享頁面與好友協作

### 正式部署步驟
1. 建立 Supabase 專案：https://supabase.com/dashboard
2. 在 Supabase 的 SQL Editor 執行 `supabase/schema.sql` 全部內容。
3. 取得 Project URL 與 Publishable key（舊專案可使用 anon key）。
4. 登入 https://vercel.com，匯入此 GitHub repository，使用 Next.js 部署。
5. 在 Vercel Environment Variables 加入 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，再 Deploy。
6. 回 Supabase Authentication > URL Configuration，將 Vercel 網址設為 Site URL，並加入 Redirect URLs。

### 本機執行
Node.js 20.9+。複製 `.env.example` 為 `.env.local` 並填入 Supabase URL/key，執行 `npm install`、`npm run dev`。

### 安全
**不得**將 Supabase `service_role` 或 secret key 放在前端或任何 `NEXT_PUBLIC_` 變數。此版本採家庭共用帳號，家人使用同一組登入資料即可共用收藏；網站僅提供登入，不開放陌生人自行註冊。資料透過 RLS 限制在家庭共用帳號內。上線前應以兩個帳號驗證資料隔離。