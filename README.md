## My Travel V1

家庭私人版繁體中文旅遊收藏管理 Web App。家人各自使用自己的 Email 登入，但共同查看、建立、修改及刪除同一份家庭旅行資料。不提供公開註冊。

### 目前版本
- 家庭成員各自使用 Email 登入、登出（Supabase Auth）
- 透過家庭成員名單共享同一份旅行專案與地點收藏
- 新增旅行專案及地點收藏
- 收藏欄位：地點名稱、國家、城市、區域、分類、地址、原始貼文網址、備註及圖片
- 搜尋收藏及依旅行專案篩選
- 初步重複提醒
- Google Maps Places API 店家搜尋；僅保存 Google Place ID，店家名稱及地址由家人自行填寫
- Supabase Row Level Security，只有同一家庭名單中的帳號可讀寫家庭資料
- 圖片儲存在 private Storage bucket，只有同一家庭成員可讀取及管理

### 尚未完成（後續版本）
- 手機分享選單直接傳入 My Travel
- AI 自動讀取社群貼文並辨識地點
- 地圖顯示／定位
- 每日行程編排與拖曳排序
- 家庭管理介面（新增／移除成員）

### 正式部署步驟
1. 建立 Supabase 專案：https://supabase.com/dashboard
2. 在 Supabase 的 SQL Editor 執行 `supabase/schema.sql` 全部內容。
3. 在 Authentication 建立家庭成員帳號，並關閉公開註冊。
4. 將同一家庭的 Auth 使用者加入 `public.household_members`，每位成員使用相同的 `household_id`。只有被加入名單的帳號能共享家庭資料。
5. 取得 Project URL 與 Publishable key。
6. 登入 https://vercel.com，匯入此 GitHub repository，使用 Next.js 部署。
7. 在 Vercel Environment Variables 加入 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，再 Deploy。
8. 回 Supabase Authentication > URL Configuration，將 Vercel 網址設為 Site URL，並加入 Redirect URLs。

### 本機執行
Node.js 20.9+。複製 `.env.example` 為 `.env.local` 並填入 Supabase URL/key，執行 `npm install`、`npm run dev`。

### 安全
**不得**將 Supabase `service_role` 或 secret key 放在前端或任何 `NEXT_PUBLIC_` 變數。此版本採獨立帳號登入、家庭成員清單授權。公開註冊應保持關閉；新增家庭成員時，由管理者在 Supabase Authentication 建立帳號，再以資料庫管理權限將該帳號加入正確的 `household_id`。資料及私有圖片均透過 RLS 限制為同一家庭成員可存取。


Google Maps Places API 使用規範：搜尋結果只作即時顯示；資料庫只保存 Google Place ID。收藏名稱、地址及備註由使用者自行輸入。網站提供 /terms 與 /privacy 公開政策頁面。
