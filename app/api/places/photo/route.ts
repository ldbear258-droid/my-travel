import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const authParts = authorization.split(" ");
  const accessToken = authParts.length === 2 && authParts[0].toLowerCase() === "bearer" ? authParts[1] : "";
  if (!accessToken) return NextResponse.json({ error: "請先登入 My Travel。" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "網站登入服務尚未完成設定。" }, { status: 500 });
  if (!googleApiKey) return NextResponse.json({ error: "Google Maps 相片功能尚未設定。" }, { status: 503 });

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: "Bearer " + accessToken } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: "登入狀態已失效，請重新登入。" }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("household_members").select("user_id").eq("user_id", authData.user.id).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "此帳號尚未加入家庭收藏空間。" }, { status: 403 });

  let body: { placeId?: unknown; photoName?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "相片資料格式不正確。" }, { status: 400 }); }

  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const photoName = typeof body.photoName === "string" ? body.photoName.trim() : "";
  const expectedPrefix = "places/" + placeId + "/photos/";
  if (
    !placeId || placeId.length > 300 || placeId.includes("/") ||
    !photoName.startsWith(expectedPrefix) ||
    photoName.split("/").length !== 4 ||
    photoName.includes("..")
  ) {
    return NextResponse.json({ error: "Google Maps 相片識別資料不正確，請重新載入相片。" }, { status: 400 });
  }

  try {
    const resourcePath = photoName.split("/").map(segment => encodeURIComponent(segment)).join("/");
    const googleResponse = await fetch(
      "https://places.googleapis.com/v1/" + resourcePath + "/media?maxWidthPx=900&maxHeightPx=560",
      {
        method: "GET",
        headers: { "X-Goog-Api-Key": googleApiKey },
        cache: "no-store",
        redirect: "follow",
      }
    );

    if (!googleResponse.ok) {
      if (googleResponse.status === 403) return NextResponse.json({ error: "Google Maps 演示金鑰目前無法提供這張相片，或每日額度已達上限。" }, { status: 502 });
      if (googleResponse.status === 404) return NextResponse.json({ error: "這張 Google Maps 相片已失效，請重新載入。" }, { status: 410 });
      if (googleResponse.status === 429) return NextResponse.json({ error: "Google Maps 相片讀取次數暫時達到上限，請稍後再試。" }, { status: 502 });
      return NextResponse.json({ error: "Google Maps 相片暫時無法取得。" }, { status: 502 });
    }

    const contentType = googleResponse.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Google Maps 沒有回傳可顯示的圖片。" }, { status: 502 });
    }
    const imageBytes = await googleResponse.arrayBuffer();
    return new Response(imageBytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Vary": "Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "連線 Google Maps 相片服務失敗，請稍後再試。" }, { status: 502 });
  }
}
