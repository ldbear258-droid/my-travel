import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type GoogleAddressComponent = { longText?: string; shortText?: string; types?: string[] };
type GooglePlaceApiResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  addressComponents?: GoogleAddressComponent[];
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

  let body: { placeId?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "地點資料格式不正確。" }, { status: 400 }); }
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId || placeId.length > 300 || placeId.includes("/")) {
    return NextResponse.json({ error: "Google Place ID 格式不正確。" }, { status: 400 });
  }

  try {
    const googleResponse = await fetch(
      "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId) + "?languageCode=zh-TW",
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": googleApiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,googleMapsUri",
        },
        cache: "no-store",
      }
    );
    if (!googleResponse.ok) {
      if (googleResponse.status === 403) return NextResponse.json({ error: "Google Maps 地點詳細資料目前無法使用，請確認演示版金鑰支援 Place Details。" }, { status: 502 });
      if (googleResponse.status === 404) return NextResponse.json({ error: "Google Maps 已找不到這個地點，請重新搜尋。" }, { status: 404 });
      if (googleResponse.status === 429) return NextResponse.json({ error: "Google Maps 搜尋次數暫時達到上限，請稍後再試。" }, { status: 502 });
      return NextResponse.json({ error: "Google Maps 地點詳細資料暫時無法取得。" }, { status: 502 });
    }
    const place = await googleResponse.json() as GooglePlaceApiResult;
    return NextResponse.json({
      place: {
        id: place.id || placeId,
        displayName: place.displayName?.text || "未提供店家名稱",
        formattedAddress: place.formattedAddress || "",
        googleMapsUri: place.googleMapsUri || "https://www.google.com/maps/search/?api=1&query_place_id=" + encodeURIComponent(placeId),
        addressComponents: place.addressComponents || [],
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "連線 Google Maps 失敗，請稍後再試。" }, { status: 502 });
  }
}
