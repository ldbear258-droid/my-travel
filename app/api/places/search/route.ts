import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type GooglePlaceApiResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const authParts = authorization.split(" ");
  const accessToken = authParts.length === 2 && authParts[0].toLowerCase() === "bearer" ? authParts[1] : "";
  if (!accessToken) return NextResponse.json({ error: "請先登入 My Travel。" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "網站登入服務尚未完成設定。" }, { status: 500 });
  if (!googleApiKey) return NextResponse.json({ error: "Google Maps 搜尋尚未啟用：管理者需要先設定 Google Maps API 金鑰。" }, { status: 503 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: "登入狀態已失效，請重新登入。" }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("household_members").select("user_id").eq("user_id", authData.user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "此帳號尚未加入家庭收藏空間。" }, { status: 403 });

  let body: { query?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "搜尋內容格式不正確。" }, { status: 400 }); }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2 || query.length > 120) return NextResponse.json({ error: "搜尋文字請輸入 2 到 120 個字。" }, { status: 400 });

  try {
    const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "zh-TW", pageSize: 6 }),
      cache: "no-store",
    });
    if (!googleResponse.ok) {
      if (googleResponse.status === 403) return NextResponse.json({ error: "Google Maps API 尚未啟用或帳單設定尚未完成，請檢查 Google Cloud 設定。" }, { status: 502 });
      if (googleResponse.status === 429) return NextResponse.json({ error: "Google Maps 搜尋次數暫時達到上限，請稍後再試。" }, { status: 502 });
      return NextResponse.json({ error: "Google Maps 搜尋暫時無法使用。" }, { status: 502 });
    }
    const data = await googleResponse.json() as { places?: GooglePlaceApiResult[] };
    const places = (data.places || []).filter(place => Boolean(place.id)).map(place => ({
      id: place.id as string,
      displayName: place.displayName?.text || "未提供店家名稱",
      formattedAddress: place.formattedAddress || "",
      googleMapsUri: place.googleMapsUri || "https://www.google.com/maps/search/?api=1&query_place_id=" + encodeURIComponent(place.id as string),
    }));
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ error: "連線 Google Maps 失敗，請稍後再試。" }, { status: 502 });
  }
}
