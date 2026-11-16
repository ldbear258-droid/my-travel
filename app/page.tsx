"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Trip = { id: string; title: string; country: string | null; city: string | null; start_date: string | null; end_date: string | null; duration_days: number | null; duration_nights: number | null; created_at: string };
type ShoppingItem = {
  id: string;
  user_id: string;
  trip_id: string | null;
  item_name: string;
  category: string;
  quantity: number | string;
  unit: string | null;
  currency: string;
  estimated_price: number | string | null;
  actual_price: number | string | null;
  store_name: string | null;
  product_url: string | null;
  purchased: boolean;
  notes: string | null;
  created_at: string;
};
type Collection = { id: string; trip_id: string | null; place_name: string; country: string | null; city: string | null; region: string | null; category: string; address: string | null; source_url: string | null; notes: string | null; image_path: string | null; google_place_id: string | null; visited: boolean; experience_rating: number | null; collection_scope: "travel" | "food_drink"; itinerary_day: number | null; created_at: string; image_url?: string | null };
type GoogleAddressComponent = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = { id: string; displayName: string; formattedAddress: string; googleMapsUri: string; addressComponents?: GoogleAddressComponent[] };
type GooglePhotoAuthor = { displayName?: string; uri?: string; photoUri?: string };
type GooglePlacePhoto = { name: string; widthPx?: number; heightPx?: number; googleMapsUri?: string; authorAttributions?: GooglePhotoAuthor[] };
type GoogleLocationGuess = { country: string; city: string; municipality: string; region: string };

function getGoogleComponent(components: GoogleAddressComponent[] = [], ...types: string[]) {
  const found = components.find(component => types.some(type => component.types?.includes(type)));
  return found?.longText || found?.shortText || "";
}

function normalizeGoogleLocation(place: GooglePlace): GoogleLocationGuess {
  const components = place.addressComponents || [];
  const countryComponent = components.find(component => component.types?.includes("country"));
  const countryCode = (countryComponent?.shortText || "").toUpperCase();
  const countryLabels: Record<string, string> = {
    TW: "台灣", JP: "日本", KR: "韓國", HK: "香港", MO: "澳門", TH: "泰國",
    SG: "新加坡", MY: "馬來西亞", US: "美國", CA: "加拿大", GB: "英國",
    FR: "法國", IT: "義大利", AU: "澳洲"
  };
  const rawCountry = countryComponent?.longText || countryComponent?.shortText || "";
  const country = countryLabels[countryCode] || COUNTRY_OPTIONS.find(option => option === rawCountry) || rawCountry;
  const rawAdmin1 = getGoogleComponent(components, "administrative_area_level_1");
  const japanesePrefectures: Record<string, string> = {
    "okinawa": "沖繩縣", "okinawa prefecture": "沖繩縣", "沖縄県": "沖繩縣",
    "tokyo": "東京都", "tokyo metropolis": "東京都", "東京都": "東京都",
    "osaka": "大阪府", "osaka prefecture": "大阪府", "大阪府": "大阪府",
    "kyoto": "京都府", "kyoto prefecture": "京都府", "京都府": "京都府",
    "hokkaido": "北海道", "北海道": "北海道",
    "fukuoka": "福岡縣", "fukuoka prefecture": "福岡縣", "福岡県": "福岡縣",
    "kanagawa": "神奈川縣", "愛知県": "愛知縣", "千葉県": "千葉縣"
  };
  const city = country === "日本"
    ? (japanesePrefectures[rawAdmin1.toLowerCase()] || japanesePrefectures[rawAdmin1] || rawAdmin1)
    : (rawAdmin1 || getGoogleComponent(components, "locality", "postal_town"));
  const municipality = getGoogleComponent(
    components,
    "locality",
    "administrative_area_level_2",
    "postal_town",
    "sublocality_level_1"
  );
  let region = "";
  if (country === "日本" && city === "沖繩縣") {
    const placeText = [municipality, rawAdmin1, ...components.map(component => component.longText || "")].join(" ").toLowerCase();
    if (/石垣|宮古|竹富|與那國|久米島|座間味|渡嘉敷|ishigaki|miyako|kumejima|zamami|tokashiki|yaeyama/.test(placeText)) region = "離島";
    else if (/本部|名護|國頭|今歸仁|大宜味|東村|宜野座|恩納|伊江|motobu|nago|kunigami|nakijin|ogimi|higashi|ginoza|onna|ie village/.test(placeText)) region = "北部";
    else if (/沖繩市|うるま|宜野灣|北谷|嘉手納|讀谷|北中城|中城|金武|okinawa city|uruma|ginowan|chatan|kadena|yomitan|kitanakagusuku|nakagusuku|kin town/.test(placeText)) region = "中部";
    else if (/那霸|浦添|豐見城|糸滿|南城|南風原|與那原|西原|八重瀬|naha|urasoe|tomigusuku|itoman|nanjo|haebaru|yonabaru|nishihara|yaese/.test(placeText)) region = "南部";
  }
  return { country, city, municipality, region };
}

const LOCATION_OPTIONS: Record<string, Record<string, string[]>> = {
  "台灣": {
    "台北市": ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"],
    "新北市": ["板橋區", "中和區", "永和區", "新莊區", "三重區", "土城區", "樹林區", "淡水區", "汐止區", "林口區", "三峽區", "鶯歌區", "蘆洲區", "五股區", "泰山區", "八里區", "三芝區", "金山區", "萬里區", "深坑區", "石碇區", "坪林區", "石門區", "平溪區", "雙溪區", "貢寮區", "烏來區", "瑞芳區"],
    "基隆市": ["仁愛區", "信義區", "中正區", "中山區", "安樂區", "暖暖區", "七堵區"],
    "桃園市": ["桃園區", "中壢區", "八德區", "平鎮區", "龜山區", "蘆竹區", "大園區", "觀音區", "新屋區", "楊梅區", "龍潭區", "大溪區", "復興區"],
    "新竹市": ["東區", "北區", "香山區"],
    "新竹縣": ["竹北市", "竹東鎮", "湖口鄉", "新豐鄉", "新埔鎮", "關西鎮", "芎林鄉", "寶山鄉", "北埔鄉", "峨眉鄉", "橫山鄉", "尖石鄉", "五峰鄉"],
    "苗栗縣": ["苗栗市", "頭份市", "竹南鎮", "後龍鎮", "通霄鎮", "苑裡鎮", "卓蘭鎮", "造橋鄉", "西湖鄉", "頭屋鄉", "公館鄉", "銅鑼鄉", "三義鄉", "大湖鄉", "獅潭鄉", "三灣鄉", "南庄鄉", "泰安鄉"],
    "台中市": ["中區", "東區", "南區", "西區", "北區", "西屯區", "南屯區", "北屯區", "豐原區", "大里區", "太平區", "清水區", "沙鹿區", "大甲區", "霧峰區", "烏日區", "后里區", "神岡區", "潭子區", "大雅區", "新社區", "石岡區", "外埔區", "大安區", "梧棲區", "龍井區", "大肚區", "東勢區", "和平區"],
    "彰化縣": ["彰化市", "員林市", "鹿港鎮", "和美鎮", "溪湖鎮", "田中鎮", "北斗鎮", "二林鎮", "花壇鄉", "芬園鄉", "秀水鄉", "福興鄉", "埔心鄉", "埔鹽鄉", "大村鄉", "永靖鄉", "社頭鄉", "田尾鄉", "埤頭鄉", "芳苑鄉", "大城鄉", "竹塘鄉", "溪州鄉", "線西鄉", "伸港鄉", "二水鄉"],
    "南投縣": ["南投市", "埔里鎮", "草屯鎮", "竹山鎮", "集集鎮", "名間鄉", "鹿谷鄉", "中寮鄉", "魚池鄉", "國姓鄉", "水里鄉", "信義鄉", "仁愛鄉"],
    "雲林縣": ["斗六市", "斗南鎮", "虎尾鎮", "西螺鎮", "土庫鎮", "北港鎮", "古坑鄉", "大埤鄉", "莿桐鄉", "林內鄉", "二崙鄉", "崙背鄉", "麥寮鄉", "東勢鄉", "褒忠鄉", "台西鄉", "元長鄉", "四湖鄉", "口湖鄉", "水林鄉"],
    "嘉義市": ["東區", "西區"],
    "嘉義縣": ["太保市", "朴子市", "布袋鎮", "大林鎮", "民雄鄉", "溪口鄉", "新港鄉", "六腳鄉", "東石鄉", "義竹鄉", "鹿草鄉", "水上鄉", "中埔鄉", "竹崎鄉", "梅山鄉", "番路鄉", "大埔鄉", "阿里山鄉"],
    "台南市": ["中西區", "東區", "南區", "北區", "安平區", "安南區", "永康區", "歸仁區", "新化區", "左鎮區", "玉井區", "楠西區", "南化區", "仁德區", "關廟區", "龍崎區", "官田區", "麻豆區", "佳里區", "西港區", "七股區", "將軍區", "學甲區", "北門區", "新營區", "後壁區", "白河區", "東山區", "六甲區", "下營區", "柳營區", "鹽水區", "善化區", "大內區", "山上區", "新市區", "安定區"],
    "高雄市": ["新興區", "前金區", "苓雅區", "鹽埕區", "鼓山區", "旗津區", "前鎮區", "三民區", "楠梓區", "小港區", "左營區", "仁武區", "大社區", "岡山區", "路竹區", "阿蓮區", "田寮區", "燕巢區", "橋頭區", "梓官區", "彌陀區", "永安區", "湖內區", "鳳山區", "大寮區", "林園區", "鳥松區", "大樹區", "旗山區", "美濃區", "六龜區", "內門區", "杉林區", "甲仙區", "桃源區", "那瑪夏區", "茂林區", "茄萣區"],
    "屏東縣": ["屏東市", "潮州鎮", "東港鎮", "恆春鎮", "萬丹鄉", "長治鄉", "麟洛鄉", "九如鄉", "里港鄉", "鹽埔鄉", "高樹鄉", "萬巒鄉", "內埔鄉", "竹田鄉", "新埤鄉", "枋寮鄉", "新園鄉", "崁頂鄉", "林邊鄉", "南州鄉", "佳冬鄉", "琉球鄉", "車城鄉", "滿州鄉", "枋山鄉", "三地門鄉", "霧台鄉", "瑪家鄉", "泰武鄉", "來義鄉", "春日鄉", "獅子鄉", "牡丹鄉"],
    "宜蘭縣": ["宜蘭市", "羅東鎮", "蘇澳鎮", "頭城鎮", "礁溪鄉", "壯圍鄉", "員山鄉", "冬山鄉", "五結鄉", "三星鄉", "大同鄉", "南澳鄉"],
    "花蓮縣": ["花蓮市", "鳳林鎮", "玉里鎮", "新城鄉", "吉安鄉", "壽豐鄉", "光復鄉", "豐濱鄉", "瑞穗鄉", "富里鄉", "秀林鄉", "萬榮鄉", "卓溪鄉"],
    "台東縣": ["台東市", "成功鎮", "關山鎮", "卑南鄉", "鹿野鄉", "池上鄉", "東河鄉", "長濱鄉", "太麻里鄉", "大武鄉", "綠島鄉", "海端鄉", "延平鄉", "金峰鄉", "達仁鄉", "蘭嶼鄉"],
    "澎湖縣": ["馬公市", "湖西鄉", "白沙鄉", "西嶼鄉", "望安鄉", "七美鄉"],
    "金門縣": ["金城鎮", "金湖鎮", "金沙鎮", "金寧鄉", "烈嶼鄉", "烏坵鄉"],
    "連江縣": ["南竿鄉", "北竿鄉", "莒光鄉", "東引鄉"]
  },
  "日本": {
    "沖繩縣": ["北部", "中部", "南部", "離島"],
    "東京都": ["新宿區", "澀谷區", "千代田區", "中央區", "港區", "台東區", "墨田區", "江東區", "品川區", "目黑區", "大田區", "世田谷區", "中野區", "杉並區", "豐島區", "北區", "荒川區", "板橋區", "練馬區", "足立區", "葛飾區", "江戶川區"],
    "大阪府": ["大阪市", "堺市", "吹田市", "豐中市", "枚方市", "岸和田市", "泉佐野市"],
    "京都府": ["京都市", "宇治市", "舞鶴市"],
    "北海道": ["札幌市", "小樽市", "函館市", "旭川市", "富良野市", "登別市"],
    "福岡縣": ["福岡市", "北九州市", "太宰府市", "久留米市"],
    "神奈川縣": ["橫濱市", "鎌倉市", "箱根町", "川崎市"],
    "愛知縣": ["名古屋市", "豐田市", "犬山市"],
    "千葉縣": ["千葉市", "浦安市", "成田市"]
  },
  "韓國": {
    "首爾特別市": ["江南區", "明洞", "弘大", "梨泰院", "東大門", "鐘路區", "聖水洞", "蠶室"],
    "釜山廣域市": ["海雲台區", "南浦洞", "西面", "廣安里", "甘川洞"],
    "濟州特別自治道": ["濟州市", "西歸浦市", "涯月邑", "城山邑"]
  },
  "香港": { "香港島": ["中環", "銅鑼灣", "灣仔", "上環"], "九龍": ["尖沙咀", "旺角", "深水埗", "九龍城"], "新界": ["沙田", "荃灣", "屯門", "元朗", "西貢"] },
  "澳門": { "澳門半島": ["議事亭前地", "新馬路", "大三巴"], "氹仔": ["官也街", "路氹城"], "路環": ["路環市區"] },
  "泰國": { "曼谷": ["暹羅", "素坤逸", "是隆", "考山路"], "清邁": ["古城區", "寧曼路", "湄林"], "普吉": ["芭東", "卡塔", "卡倫"] },
  "新加坡": { "新加坡": ["濱海灣", "烏節路", "牛車水", "聖淘沙", "小印度"] },
  "馬來西亞": { "吉隆坡": ["市中心", "武吉免登", "KLCC"], "檳城": ["喬治市", "峇都丁宜"], "馬六甲": ["雞場街", "市中心"], "沙巴": ["亞庇", "仙本那"], "柔佛": ["新山"] },
  "美國": { "紐約": ["曼哈頓", "布魯克林", "皇后區"], "洛杉磯": ["好萊塢", "比佛利山", "聖塔莫尼卡"], "舊金山": ["漁人碼頭", "唐人街", "金門公園"], "拉斯維加斯": ["大道區", "市中心"], "夏威夷": ["檀香山", "威基基", "茂宜島"], "西雅圖": ["市中心", "派克市場"] },
  "加拿大": { "溫哥華": ["市中心", "列治文", "本拿比"], "多倫多": ["市中心", "北約克", "士嘉堡"], "蒙特婁": ["舊城區", "市中心"] },
  "英國": { "倫敦": ["西敏市", "蘇活區", "肯辛頓", "金絲雀碼頭"], "曼徹斯特": ["市中心", "北區"], "愛丁堡": ["舊城區", "新城區"] },
  "法國": { "巴黎": ["羅浮宮區", "艾菲爾鐵塔區", "蒙馬特", "拉丁區"], "尼斯": ["舊城區", "海濱區"], "里昂": ["市中心", "舊城區"] },
  "義大利": { "羅馬": ["歷史中心", "梵蒂岡周邊"], "米蘭": ["大教堂區", "布雷拉區"], "威尼斯": ["聖馬可區", "里亞托區"], "佛羅倫斯": ["歷史中心"] },
  "澳洲": { "雪梨": ["市中心", "達令港", "邦迪海灘"], "墨爾本": ["市中心", "聖基爾達"], "布里斯本": ["市中心", "南岸"], "珀斯": ["市中心", "弗里曼特爾"] }
};
const COUNTRY_OPTIONS = Object.keys(LOCATION_OPTIONS);
const categories = ["景點", "美食", "購物", "住宿", "交通", "其他"];
const SHOPPING_CATEGORIES = ["藥妝／保養", "食品／伴手禮", "服飾／鞋包", "3C／電器", "生活用品", "玩具／親子", "其他"];
const SHOPPING_CURRENCIES = [
  { code: "TWD", label: "新台幣 TWD" },
  { code: "JPY", label: "日圓 JPY" },
  { code: "USD", label: "美元 USD" },
  { code: "KRW", label: "韓元 KRW" },
  { code: "HKD", label: "港幣 HKD" },
  { code: "CNY", label: "人民幣 CNY" },
  { code: "THB", label: "泰銖 THB" },
  { code: "SGD", label: "新加坡幣 SGD" },
  { code: "EUR", label: "歐元 EUR" },
];
function formatShoppingMoney(amount: number | string | null, currency: string) {
  if (amount === null || amount === "") return "未填寫";
  const value = Number(amount);
  return Number.isFinite(value) ? currency + " " + value.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : "未填寫";
}
const EXPERIENCE_RATINGS: Record<string, { question: string; options: string[] }> = {
  "景點": { question: "玩起來如何？", options: ["非常好玩", "好玩", "普通", "不好玩"] },
  "美食": { question: "好不好吃？", options: ["非常好吃", "好吃", "普通", "不好吃"] },
  "購物": { question: "好不好逛？", options: ["非常好逛", "好逛", "普通", "不好逛"] },
  "住宿": { question: "住宿體驗如何？", options: ["非常滿意", "滿意", "普通", "不滿意"] },
  "交通": { question: "交通方便嗎？", options: ["非常方便", "方便", "普通", "不方便"] },
  "其他": { question: "整體體驗如何？", options: ["非常推薦", "推薦", "普通", "不推薦"] },
};
function getGoogleMapsPlaceUrl(placeName: string, placeId: string) {
  const params = new URLSearchParams({
    api: "1",
    query: placeName || placeId,
    query_place_id: placeId,
  });
  return "https://www.google.com/maps/search/?" + params.toString();
}
const supabase = getSupabase();

function GoogleMapsPlacePhoto({ placeId, placeName }: { placeId: string; placeName: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [photo, setPhoto] = useState<{ url: string; googleMapsUri: string; authors: GooglePhotoAuthor[] } | null>(null);
  const [status, setStatus] = useState<"waiting" | "loading" | "missing" | "error">("waiting");

  useEffect(() => {
    let disposed = false;
    let objectUrl = "";
    let started = false;
    let observer: IntersectionObserver | null = null;

    async function loadPhoto() {
      if (started) return;
      started = true;
      setStatus("loading");
      try {
        const { data: authData } = await supabase.auth.getSession();
        const accessToken = authData.session?.access_token;
        if (!accessToken) throw new Error("登入狀態已失效。");

        const detailsResponse = await fetch("/api/places/details", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
          body: JSON.stringify({ placeId, includePhotos: true }),
          cache: "no-store",
        });
        const detailsResult = await detailsResponse.json();
        if (!detailsResponse.ok) throw new Error(detailsResult.error || "無法取得地點相片資料。");

        const photoData = (detailsResult.place?.photos || []) as GooglePlacePhoto[];
        const firstPhoto = photoData.find(item => Boolean(item.name));
        if (!firstPhoto?.name) {
          if (!disposed) setStatus("missing");
          return;
        }

        const imageResponse = await fetch("/api/places/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
          body: JSON.stringify({ placeId, photoName: firstPhoto.name }),
          cache: "no-store",
        });
        if (!imageResponse.ok) {
          const errorResult = await imageResponse.json().catch(() => ({}));
          throw new Error(errorResult.error || "無法載入 Google Maps 相片。");
        }

        const imageBlob = await imageResponse.blob();
        if (!imageBlob.type.toLowerCase().startsWith("image/")) throw new Error("Google Maps 沒有回傳可顯示的圖片。");
        objectUrl = URL.createObjectURL(imageBlob);
        if (disposed) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = "";
          return;
        }
        setPhoto({
          url: objectUrl,
          googleMapsUri: firstPhoto.googleMapsUri || getGoogleMapsPlaceUrl(placeName, placeId),
          authors: firstPhoto.authorAttributions || [],
        });
      } catch {
        if (!disposed) setStatus("error");
      }
    }

    const element = containerRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      void loadPhoto();
    } else {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer?.disconnect();
          void loadPhoto();
        }
      }, { rootMargin: "160px 0px" });
      observer.observe(element);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [placeId, placeName]);

  const attributionAuthors = photo?.authors || [];
  return (
    <div className="google-photo-wrap" ref={containerRef}>
      {photo ? (
        <>
          <a className="google-photo-image-link" href={photo.googleMapsUri} target="_blank" rel="noreferrer" aria-label={"在 Google Maps 查看 " + placeName + " 的原始相片"}>
            <img className="google-photo-image" src={photo.url} alt={placeName + " 的 Google Maps 相片"} />
          </a>
          <div className="google-photo-attribution">
            <a href={photo.googleMapsUri} target="_blank" rel="noreferrer" translate="no">Google Maps</a>
            {attributionAuthors.map((author, index) => {
              const profileUrl = author.uri ? (author.uri.startsWith("//") ? "https:" + author.uri : author.uri) : "";
              const avatarUrl = author.photoUri ? (author.photoUri.startsWith("//") ? "https:" + author.photoUri : author.photoUri) : "";
              return profileUrl ? (
                <a className="google-photo-author" href={profileUrl} target="_blank" rel="noreferrer" key={profileUrl + index}>
                  {avatarUrl && <img src={avatarUrl} alt="" />}
                  <span>{author.displayName || "相片作者"}</span>
                </a>
              ) : author.displayName ? <span key={author.displayName + index}>{author.displayName}</span> : null;
            })}
          </div>
        </>
      ) : (
        <div className="google-photo-placeholder">
          <span>✧</span>
          <small>{status === "loading" ? "Google Maps 相片載入中…" : status === "missing" ? "目前沒有可提供的 Google Maps 相片" : status === "error" ? "Google Maps 相片暫時無法載入" : "Google Maps 相片"}</small>
        </div>
      )}
    </div>
  );
}


export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [items, setItems] = useState<Collection[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [activePage, setActivePage] = useState<"collections" | "food_drink" | "shopping">("collections");
  const [foodDrinkSearch, setFoodDrinkSearch] = useState("");
  const [shoppingSearch, setShoppingSearch] = useState("");
  const [shoppingFormOpen, setShoppingFormOpen] = useState(false);
  const [shoppingEditingId, setShoppingEditingId] = useState<string | null>(null);
  const [shoppingBusy, setShoppingBusy] = useState(false);
  const [shoppingName, setShoppingName] = useState("");
  const [shoppingStoreName, setShoppingStoreName] = useState("");
  const [shoppingProductUrl, setShoppingProductUrl] = useState("");
  const [shoppingCategory, setShoppingCategory] = useState("其他");
  const [shoppingTripId, setShoppingTripId] = useState("all");
  const [shoppingQuantity, setShoppingQuantity] = useState("1");
  const [shoppingUnit, setShoppingUnit] = useState("");
  const [shoppingCurrency, setShoppingCurrency] = useState("TWD");
  const [shoppingEstimatedPrice, setShoppingEstimatedPrice] = useState("");
  const [shoppingActualPrice, setShoppingActualPrice] = useState("");
  const [shoppingNotes, setShoppingNotes] = useState("");
  const [inlineSavingIds, setInlineSavingIds] = useState<string[]>([]);
  const [selectedTrip, setSelectedTrip] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [tripTitle, setTripTitle] = useState("");
  const [tripDays, setTripDays] = useState("");
  const [tripNights, setTripNights] = useState("");
  const [tripCountry, setTripCountry] = useState("");
  const [tripCity, setTripCity] = useState("");
  const [tripCountryCustom, setTripCountryCustom] = useState(false);
  const [tripCityCustom, setTripCityCustom] = useState(false);
  const [placeCountryCustom, setPlaceCountryCustom] = useState(false);
  const [placeCityCustom, setPlaceCityCustom] = useState(false);
  const [placeRegionCustom, setPlaceRegionCustom] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [collectionScope, setCollectionScope] = useState<"travel" | "food_drink">("travel");
  const [itineraryDay, setItineraryDay] = useState("");
  const [placeCountry, setPlaceCountry] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [placeRegion, setPlaceRegion] = useState("");
  const [category, setCategory] = useState("景點");
  const [visited, setVisited] = useState(false);
  const [experienceRating, setExperienceRating] = useState("");
  const [address, setAddress] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<GooglePlace[]>([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMessage, setGoogleMessage] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [selectedGooglePlace, setSelectedGooglePlace] = useState<GooglePlace | null>(null);
  const [googleMunicipality, setGoogleMunicipality] = useState("");
  const [googleDetailsCache, setGoogleDetailsCache] = useState<Record<string, GooglePlace>>({});
  const [expandedGooglePlaceId, setExpandedGooglePlaceId] = useState<string | null>(null);
  const [googleDetailsBusyId, setGoogleDetailsBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadData();
  }, [session?.user?.id]);

  async function loadData() {
    const [
      { data: tripData, error: tripError },
      { data: collectionData, error: collectionError },
      { data: shoppingData, error: shoppingError },
    ] = await Promise.all([
      supabase.from("trips").select("*").order("created_at", { ascending: false }),
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
      supabase.from("shopping_items").select("*").order("created_at", { ascending: false }),
    ]);
    if (tripError || collectionError || shoppingError) {
      setMessage(tripError?.message || collectionError?.message || shoppingError?.message || "讀取資料失敗");
      return;
    }
    setTrips((tripData || []) as Trip[]);
    setShoppingItems((shoppingData || []) as ShoppingItem[]);
    const rows = (collectionData || []) as Collection[];
    const withSignedImages = await Promise.all(rows.map(async (row) => {
      if (!row.image_path) return row;
      const { data } = await supabase.storage.from("collection-media").createSignedUrl(row.image_path, 60 * 60);
      return { ...row, image_url: data?.signedUrl || null } as Collection & { image_url?: string | null };
    }));
    setItems(withSignedImages as Collection[]);
  }

  async function authenticate(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) setMessage("登入失敗，請確認你的電子郵件與密碼。");
    else setMessage("");
  }

  async function searchGoogleMaps(e: FormEvent) {
    e.preventDefault();
    const query = googleQuery.trim();
    if (query.length < 2) { setGoogleMessage("請至少輸入 2 個字再搜尋。"); return; }
    setGoogleBusy(true); setGoogleMessage(""); setGoogleResults([]);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (!accessToken) { setGoogleMessage("登入狀態已失效，請重新登入。"); return; }
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ query }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Google Maps 搜尋失敗。");
      const results = (result.places || []) as GooglePlace[];
      setGoogleResults(results);
      if (results.length === 0) setGoogleMessage("沒有找到符合的店家，試試加上城市或國家，例如「拉麵 沖繩」。");
    } catch (error) {
      setGoogleMessage(error instanceof Error ? error.message : "搜尋失敗，請稍後再試。");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function fetchGooglePlaceDetails(placeId: string): Promise<GooglePlace | null> {
    setGoogleDetailsBusyId(placeId);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (!accessToken) throw new Error("登入狀態已失效，請重新登入。");
      const response = await fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ placeId }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "無法取得 Google Maps 地點資料。");
      const place = result.place as GooglePlace;
      setGoogleDetailsCache(previous => ({ ...previous, [placeId]: place }));
      return place;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法取得 Google Maps 地點資料。");
      return null;
    } finally {
      setGoogleDetailsBusyId(null);
    }
  }

  function applyGooglePlaceToForm(place: GooglePlace) {
    const location = normalizeGoogleLocation(place);
    const cityOptions = location.country ? Object.keys(LOCATION_OPTIONS[location.country] || {}) : [];
    const regionOptions = LOCATION_OPTIONS[location.country]?.[location.city] || [];
    setPlaceCountry(location.country);
    setPlaceCountryCustom(Boolean(location.country && !COUNTRY_OPTIONS.includes(location.country)));
    setPlaceCity(location.city);
    setPlaceCityCustom(Boolean(location.city && !cityOptions.includes(location.city)));
    setPlaceRegion(location.region);
    setPlaceRegionCustom(Boolean(location.region && !regionOptions.includes(location.region)));
    setGoogleMunicipality(location.municipality);
    setAddress(place.formattedAddress || "");
  }

  function startNewCollection() {
    const nextScope = activePage === "food_drink" ? "food_drink" : "travel";
    setCollectionScope(nextScope);
    setItineraryDay("");
    setEditingId(null); setExistingImagePath(null); setPlaceName(""); setPlaceCountry(""); setPlaceCity("");
    setPlaceRegion(""); setPlaceCountryCustom(false); setPlaceCityCustom(false); setPlaceRegionCustom(false);
    setCategory(nextScope === "food_drink" ? "美食" : "景點"); setVisited(false); setExperienceRating(""); setAddress(""); setSourceUrl(""); setNotes(""); setImageFile(null);
    setGooglePlaceId(null); setSelectedGooglePlace(null); setGoogleMunicipality(""); setShowSaveForm(true);
  }

  function chooseGooglePlace(place: GooglePlace) {
    startNewCollection();
    setGooglePlaceId(place.id);
    setSelectedGooglePlace(place);
    setGoogleDetailsCache(previous => ({ ...previous, [place.id]: place }));
    // Keep the user's search phrase as their editable collection title; Google name is shown live above only.
    setPlaceName(googleQuery.trim());
    applyGooglePlaceToForm(place);
    setGoogleMessage("");
    // Successful selection stays quiet and preserves the user's current scroll position.
    setMessage("");
  }

  async function createTrip(e: FormEvent) {
    e.preventDefault(); if (!session) return;
    const days = tripDays ? Number(tripDays) : null;
    const nights = tripNights ? Number(tripNights) : null;
    if ((days === null) !== (nights === null) || (days !== null && (!Number.isInteger(days) || days < 1 || days > 30 || !Number.isInteger(nights) || (nights as number) < 0 || (nights as number) > days))) {
      setMessage("請確認旅行天數與夜數；夜數不可多於天數。");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("trips").insert({
      user_id: session.user.id,
      title: tripTitle,
      country: tripCountry || null,
      city: tripCity || null,
      duration_days: days,
      duration_nights: nights,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setTripTitle(""); setTripDays(""); setTripNights(""); setTripCountry(""); setTripCity("");
      setTripCountryCustom(false); setTripCityCustom(false); setShowTripForm(false); setMessage(""); loadData();
    }
  }

  async function saveCollection(e: FormEvent) {
    e.preventDefault(); if (!session) return;
    if (!placeName.trim()) { setMessage("請先填寫地點或店家名稱"); return; }
    setBusy(true); setMessage("");
    const duplicate = items.find(x => x.id !== editingId && ((googlePlaceId && x.google_place_id === googlePlaceId) || (x.place_name.trim().toLocaleLowerCase() === placeName.trim().toLocaleLowerCase() && (x.address || "").trim().toLocaleLowerCase() === address.trim().toLocaleLowerCase())));
    let image_path: string | null = existingImagePath;
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${session.user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("collection-media").upload(path, imageFile, { upsert: false });
      if (uploadError) { setBusy(false); setMessage("圖片上傳失敗：" + uploadError.message); return; }
      image_path = path;
    }
    const targetTrip = collectionScope === "travel" && selectedTrip !== "all" ? trips.find(trip => trip.id === selectedTrip) : null;
    const dayNumber = itineraryDay ? Number(itineraryDay) : null;
    if (collectionScope === "travel" && dayNumber !== null && (!targetTrip?.duration_days || dayNumber < 1 || dayNumber > targetTrip.duration_days)) {
      setBusy(false);
      setMessage("行程日必須在這趟旅行的天數範圍內。");
      return;
    }
    const payload = {
      collection_scope: collectionScope,
      trip_id: collectionScope === "travel" && selectedTrip !== "all" ? selectedTrip : null,
      itinerary_day: collectionScope === "travel" ? dayNumber : null,
      place_name: placeName.trim(),
      // Google Maps content is displayed from a fresh lookup; only its exempt Place ID is persisted.
      country: googlePlaceId ? null : (placeCountry || null),
      city: googlePlaceId ? null : (placeCity || null),
      region: googlePlaceId ? null : (placeRegion || null),
      category,
      visited,
      experience_rating: visited && experienceRating ? Number(experienceRating) : null,
      address: googlePlaceId ? null : (address || null),
      source_url: sourceUrl || null,
      notes: notes || null, image_path, google_place_id: googlePlaceId
    };
    const result = editingId
      ? await supabase.from("collections").update(payload).eq("id", editingId)
      : await supabase.from("collections").insert({ ...payload, user_id: session.user.id });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else {
      setPlaceName(""); setPlaceCountry(""); setPlaceCity(""); setPlaceRegion(""); setAddress(""); setSourceUrl(""); setNotes(""); setImageFile(null); setGoogleMunicipality(""); setVisited(false); setExperienceRating(""); setItineraryDay("");
      setEditingId(null); setExistingImagePath(null); setGooglePlaceId(null); setSelectedGooglePlace(null); setShowSaveForm(false);
      setMessage(duplicate ? "已新增收藏，但找到名稱及地址相同的既有收藏，請確認是否重複。" : "");
      loadData();
    }
  }

  async function editCollection(item: Collection) {
    let livePlace: GooglePlace | null = null;
    if (item.google_place_id) {
      livePlace = googleDetailsCache[item.google_place_id] || await fetchGooglePlaceDetails(item.google_place_id);
    }
    setEditingId(item.id);
    setCollectionScope(item.collection_scope || "travel");
    setItineraryDay(item.itinerary_day ? String(item.itinerary_day) : "");
    setExistingImagePath(item.image_path);
    setGooglePlaceId(item.google_place_id || null);
    setSelectedGooglePlace(livePlace);
    setPlaceName(item.place_name);
    if (livePlace) {
      applyGooglePlaceToForm(livePlace);
    } else {
      setGoogleMunicipality("");
      setPlaceCountry(item.country || "");
      setPlaceCity(item.city || "");
      setPlaceRegion(item.region || "");
      setPlaceCountryCustom(Boolean(item.country && !COUNTRY_OPTIONS.includes(item.country)));
      setPlaceCityCustom(Boolean(item.city && !Object.keys(LOCATION_OPTIONS[item.country || ""] || {}).includes(item.city)));
      setPlaceRegionCustom(Boolean(item.region && !(LOCATION_OPTIONS[item.country || ""]?.[item.city || ""] || []).includes(item.region)));
      setAddress(item.address || "");
    }
    setCategory(item.category);
    setVisited(Boolean(item.visited));
    setExperienceRating(item.experience_rating ? String(item.experience_rating) : "");
    setSourceUrl(item.source_url || "");
    setNotes(item.notes || "");
    setImageFile(null);
    setSelectedTrip(item.trip_id || "all");
    setShowSaveForm(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteTrip(trip: Trip) {
    const linkedCount = items.filter(item => item.trip_id === trip.id).length;
    const warning = linkedCount > 0
      ? `此旅行有 ${linkedCount} 筆收藏。刪除旅行後，這些收藏仍會保留在「全部收藏」，不會一起刪除。\n\n確定要刪除「${trip.title}」嗎？`
      : `確定要刪除旅行「${trip.title}」嗎？`;
    if (!confirm(warning)) return;
    setBusy(true);
    const { error } = await supabase.from("trips").delete().eq("id", trip.id);
    setBusy(false);
    if (error) {
      setMessage("刪除旅行失敗：" + error.message);
      return;
    }
    if (selectedTrip === trip.id) setSelectedTrip("all");
    setMessage("");
    await loadData();
  }

  async function updateInlineVisit(item: Collection, nextVisited: boolean, nextRating: number | null) {
    if (inlineSavingIds.includes(item.id)) return;
    setInlineSavingIds(previous => [...previous, item.id]);
    setItems(previous => previous.map(existing => existing.id === item.id
      ? { ...existing, visited: nextVisited, experience_rating: nextRating }
      : existing
    ));

    const { error } = await supabase
      .from("collections")
      .update({ visited: nextVisited, experience_rating: nextVisited ? nextRating : null })
      .eq("id", item.id);

    if (error) {
      setItems(previous => previous.map(existing => existing.id === item.id
        ? { ...existing, visited: item.visited, experience_rating: item.experience_rating }
        : existing
      ));
      setMessage("更新已去過／體驗評價失敗：" + error.message);
    }
    setInlineSavingIds(previous => previous.filter(id => id !== item.id));
  }

  async function deleteCollection(id: string) {
    if (!confirm("確定刪除這筆收藏？")) return;
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) setMessage(error.message); else { setMessage(""); loadData(); }
  }

  function resetShoppingForm() {
    setShoppingEditingId(null);
    setShoppingName("");
    setShoppingStoreName("");
    setShoppingProductUrl("");
    setShoppingCategory("其他");
    setShoppingTripId(selectedTrip);
    setShoppingQuantity("1");
    setShoppingUnit("");
    setShoppingCurrency("TWD");
    setShoppingEstimatedPrice("");
    setShoppingActualPrice("");
    setShoppingNotes("");
  }

  function startShoppingItem() {
    resetShoppingForm();
    setShoppingFormOpen(true);
  }

  function editShoppingItem(item: ShoppingItem) {
    setShoppingEditingId(item.id);
    setShoppingName(item.item_name);
    setShoppingStoreName(item.store_name || "");
    setShoppingProductUrl(item.product_url || "");
    setShoppingCategory(item.category);
    setShoppingTripId(item.trip_id || "all");
    setShoppingQuantity(String(item.quantity ?? 1));
    setShoppingUnit(item.unit || "");
    setShoppingCurrency(item.currency || "TWD");
    setShoppingEstimatedPrice(item.estimated_price === null ? "" : String(item.estimated_price));
    setShoppingActualPrice(item.actual_price === null ? "" : String(item.actual_price));
    setShoppingNotes(item.notes || "");
    setShoppingFormOpen(true);
  }

  async function saveShoppingItem(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    if (!shoppingName.trim()) {
      setMessage("請先填寫購物項目名稱。");
      return;
    }
    const quantity = Number(shoppingQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage("數量必須大於 0。");
      return;
    }
    const estimated = shoppingEstimatedPrice.trim() === "" ? null : Number(shoppingEstimatedPrice);
    const actual = shoppingActualPrice.trim() === "" ? null : Number(shoppingActualPrice);
    if ((estimated !== null && (!Number.isFinite(estimated) || estimated < 0)) ||
        (actual !== null && (!Number.isFinite(actual) || actual < 0))) {
      setMessage("金額請填寫 0 或大於 0 的數字。");
      return;
    }

    setShoppingBusy(true);
    setMessage("");
    const payload = {
      item_name: shoppingName.trim(),
      store_name: shoppingStoreName.trim() || null,
      product_url: shoppingProductUrl.trim() || null,
      category: shoppingCategory,
      trip_id: shoppingTripId === "all" ? null : shoppingTripId,
      quantity,
      unit: shoppingUnit.trim() || null,
      currency: shoppingCurrency,
      estimated_price: estimated,
      actual_price: actual,
      notes: shoppingNotes.trim() || null,
    };
    const result = shoppingEditingId
      ? await supabase.from("shopping_items").update(payload).eq("id", shoppingEditingId)
      : await supabase.from("shopping_items").insert({ ...payload, user_id: session.user.id });
    setShoppingBusy(false);
    if (result.error) {
      setMessage("購物清單儲存失敗：" + result.error.message);
      return;
    }
    setShoppingFormOpen(false);
    resetShoppingForm();
    await loadData();
  }

  async function toggleShoppingPurchased(item: ShoppingItem, purchased: boolean) {
    setShoppingItems(previous => previous.map(row => row.id === item.id ? { ...row, purchased } : row));
    const { error } = await supabase.from("shopping_items").update({ purchased }).eq("id", item.id);
    if (error) {
      setShoppingItems(previous => previous.map(row => row.id === item.id ? { ...row, purchased: item.purchased } : row));
      setMessage("更新購買狀態失敗：" + error.message);
    }
  }

  async function deleteShoppingItem(item: ShoppingItem) {
    if (!confirm("確定刪除購物項目「" + item.item_name + "」？")) return;
    const { error } = await supabase.from("shopping_items").delete().eq("id", item.id);
    if (error) setMessage("刪除購物項目失敗：" + error.message);
    else {
      setMessage("");
      setShoppingItems(previous => previous.filter(row => row.id !== item.id));
    }
  }

  async function signOut() { await supabase.auth.signOut(); setTrips([]); setItems([]); }

  const tripCityOptions = LOCATION_OPTIONS[tripCountry] ? Object.keys(LOCATION_OPTIONS[tripCountry]) : [];
  const placeCityOptions = LOCATION_OPTIONS[placeCountry] ? Object.keys(LOCATION_OPTIONS[placeCountry]) : [];
  const placeRegionOptions = LOCATION_OPTIONS[placeCountry]?.[placeCity] || [];

  const filteredShoppingItems = useMemo(() => shoppingItems.filter(item => {
    const matchesTrip = selectedTrip === "all" || item.trip_id === selectedTrip;
    const searchTarget = [item.item_name, item.category, item.notes, item.unit].join(" ").toLowerCase();
    return matchesTrip && searchTarget.includes(shoppingSearch.trim().toLowerCase());
  }), [shoppingItems, selectedTrip, shoppingSearch]);

  const shoppingTotals = useMemo(() => {
    const totals = new Map<string, { estimated: number; actual: number; hasEstimated: boolean; hasActual: boolean }>();
    for (const item of filteredShoppingItems) {
      const current = totals.get(item.currency) || { estimated: 0, actual: 0, hasEstimated: false, hasActual: false };
      const quantity = Number(item.quantity || 0);
      if (item.estimated_price !== null) {
        current.estimated += quantity * Number(item.estimated_price);
        current.hasEstimated = true;
      }
      if (item.actual_price !== null) {
        current.actual += quantity * Number(item.actual_price);
        current.hasActual = true;
      }
      totals.set(item.currency, current);
    }
    return Array.from(totals.entries()).map(([currency, values]) => ({ currency, ...values }));
  }, [filteredShoppingItems]);

  const filtered = useMemo(() => items
    .filter(item => {
      const matchesScope = item.collection_scope === "travel";
      const matchesTrip = selectedTrip === "all" || item.trip_id === selectedTrip;
      const haystack = [item.place_name, item.country, item.city, item.region, item.category, item.address].join(" ").toLowerCase();
      return matchesScope && matchesTrip && haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (selectedTrip !== "all") {
        const dayA = a.itinerary_day ?? Number.MAX_SAFE_INTEGER;
        const dayB = b.itinerary_day ?? Number.MAX_SAFE_INTEGER;
        if (dayA !== dayB) return dayA - dayB;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }), [items, selectedTrip, search]);

  const filteredFoodDrink = useMemo(() => items.filter(item => {
    const haystack = [item.place_name, item.country, item.city, item.region, item.category, item.address, item.notes].join(" ").toLowerCase();
    return item.collection_scope === "food_drink" && haystack.includes(foodDrinkSearch.trim().toLowerCase());
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [items, foodDrinkSearch]);

  if (!session) return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">✈</div>
        <p className="eyebrow">YOUR PLACES. YOUR JOURNEYS.</p>
        <h1>My Travel<span>.</span></h1>
        <p className="muted">把喜歡的地方，都收藏起來。</p>
        <form onSubmit={authenticate} className="stack">
          <label>電子郵件<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label>密碼<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 個字元" /></label>
          <button className="primary" disabled={busy}>{busy ? "登入中…" : "登入 My Travel"}</button>
        </form>
        {message && <p className="notice">{message}</p>}
        <p className="tiny muted">家庭成員各自登入 · 共用同一份家庭收藏</p>
      </section>
    </main>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#">✈ My Travel<span>.</span></a>
        <div className="user-tools"><span>{session.user.email}</span><button className="outline small" onClick={signOut}>登出</button></div>
      </header>
      <section className="hero">
        <div><p className="eyebrow">YOUR FAMILY TRAVEL LIBRARY</p><h1>把喜歡的地方，<br/>都收藏起來。</h1><p className="muted">你和家人各自登入，也能一起累積同一份旅行收藏。</p></div>
        <div className="hero-stats"><div><strong>{trips.length}</strong><span>旅行專案</span></div><div><strong>{items.length}</strong><span>收藏地點</span></div></div>
      </section>

      {message && <div className="notice global-notice">{message}<button onClick={() => setMessage("")}>×</button></div>}

      <section className="section-heading"><div><p className="eyebrow">TRAVEL COLLECTIONS</p><h2>家庭旅行</h2></div><button className="primary" onClick={() => setShowTripForm(!showTripForm)}>＋ 新增旅行</button></section>
      {showTripForm && <form className="panel form-grid" onSubmit={createTrip}>
        <label>旅行名稱<input required value={tripTitle} onChange={e => setTripTitle(e.target.value)} placeholder="例如：沖繩五天四夜"/></label>
        <label>旅行天數
          <select value={tripDays} onChange={event => {
            const value = event.target.value;
            setTripDays(value);
            if (!value) setTripNights("");
            else if (!tripNights || Number(tripNights) > Number(value)) setTripNights(String(Math.max(0, Number(value) - 1)));
          }}>
            <option value="">不設定</option>
            {Array.from({ length: 30 }, (_, index) => index + 1).map(day => <option key={day} value={String(day)}>{day} 天</option>)}
          </select>
        </label>
        <label>旅行夜數
          <select value={tripNights} disabled={!tripDays} onChange={event => setTripNights(event.target.value)}>
            <option value="">請選擇夜數</option>
            {Array.from({ length: Number(tripDays || 0) + 1 }, (_, index) => index).map(night => <option key={night} value={String(night)}>{night} 夜</option>)}
          </select>
        </label>
        <label>國家
          <select value={tripCountryCustom ? "__custom__" : tripCountry} onChange={e => {
            if (e.target.value === "__custom__") { setTripCountry(""); setTripCountryCustom(true); setTripCity(""); setTripCityCustom(false); }
            else { setTripCountry(e.target.value); setTripCountryCustom(false); setTripCity(""); setTripCityCustom(false); }
          }}>
            <option value="">請選擇國家</option>
            {COUNTRY_OPTIONS.map(country => <option key={country} value={country}>{country}</option>)}
            <option value="__custom__">其他／自行輸入</option>
          </select>
          {tripCountryCustom && <input value={tripCountry} onChange={e => setTripCountry(e.target.value)} placeholder="請輸入國家名稱" />}
        </label>
        <label>城市／縣市
          {!tripCountryCustom && tripCityOptions.length > 0 && !tripCityCustom ? <select value={tripCity} onChange={e => {
            if (e.target.value === "__custom__") { setTripCity(""); setTripCityCustom(true); }
            else setTripCity(e.target.value);
          }}>
            <option value="">請先選擇國家，再選城市</option>
            {tripCity && !tripCityOptions.includes(tripCity) && <option value={tripCity}>{tripCity}（既有資料）</option>}
            {tripCityOptions.map(city => <option key={city} value={city}>{city}</option>)}
            <option value="__custom__">其他／自行輸入</option>
          </select> : <input value={tripCity} onChange={e => setTripCity(e.target.value)} placeholder="請輸入城市／縣市" />}
        </label>
        <div className="form-actions"><button className="primary" disabled={busy}>儲存專案</button><button type="button" className="outline" onClick={() => setShowTripForm(false)}>取消</button></div>
      </form>}
      <div className="trip-grid">
        <button className={`trip-card all-card ${selectedTrip === "all" ? "selected" : ""}`} onClick={() => setSelectedTrip("all")}><span className="trip-icon">✧</span><strong>全部收藏</strong><span>{items.length} 個地點</span></button>
        {trips.map(trip => <div key={trip.id} className="trip-card-wrap">
          <button className={`trip-card ${selectedTrip === trip.id ? "selected" : ""}`} onClick={() => setSelectedTrip(trip.id)}>
            <span className="trip-icon">⌁</span><strong>{trip.title}</strong><span>{[trip.country, trip.city].filter(Boolean).join(" · ") || "尚未設定地區"}</span>
            {trip.duration_days && trip.duration_nights !== null && <small className="trip-duration">{trip.duration_days} 天 {trip.duration_nights} 夜</small>}
            <small>{items.filter(x => x.trip_id === trip.id && x.collection_scope === "travel").length} 個收藏</small>
          </button>
          <button type="button" className="trip-delete-btn" disabled={busy} onClick={() => deleteTrip(trip)} aria-label={`刪除旅行 ${trip.title}`} title="刪除旅行">刪除</button>
        </div>)}
      </div>

      <nav className="app-tabs" aria-label="My Travel 功能">
        <button type="button" className={activePage === "collections" ? "app-tab active" : "app-tab"} onClick={() => setActivePage("collections")}>旅行行程</button>
        <button type="button" className={activePage === "food_drink" ? "app-tab active" : "app-tab"} onClick={() => setActivePage("food_drink")}>吃喝清單 <span>{items.filter(item => item.collection_scope === "food_drink").length}</span></button>
        <button type="button" className={activePage === "shopping" ? "app-tab active" : "app-tab"} onClick={() => setActivePage("shopping")}>購物清單 <span>{shoppingItems.length}</span></button>
      </nav>

      {(activePage === "collections" || activePage === "food_drink") && <>
      <section className="section-heading collection-heading"><div><p className="eyebrow">{activePage === "food_drink" ? "FOOD & DRINK" : "TRAVEL ITINERARY"}</p><h2>{activePage === "food_drink" ? "吃喝清單" : "旅行行程收藏"}</h2></div><button className="primary" onClick={() => showSaveForm ? setShowSaveForm(false) : startNewCollection()}>{showSaveForm ? "收起表單" : activePage === "food_drink" ? "＋ 新增吃喝地點" : "＋ 新增行程地點"}</button></section>
      <section className="google-search-panel">
        <div><p className="eyebrow">FIND A PLACE</p><h3>{activePage === "food_drink" ? "從 Google Maps 搜尋餐廳／咖啡店" : "從 Google Maps 搜尋店家／景點"}</h3><p className="muted small-text">{activePage === "food_drink" ? "把平常想吃、想喝、想再訪的店家獨立收藏，不必指定旅行。" : "輸入店名、景點或城市，例如「A&W 牧港店」或「沖繩水族館」。"}</p></div>
        <form className="google-search-form" onSubmit={searchGoogleMaps}>
          <input value={googleQuery} onChange={e => setGoogleQuery(e.target.value)} placeholder="輸入店家名稱或景點…" aria-label="搜尋 Google Maps 店家" />
          <button className="primary" disabled={googleBusy || googleQuery.trim().length < 2}>{googleBusy ? "搜尋中…" : "搜尋 Google Maps"}</button>
        </form>
        {googleMessage && <p className="notice">{googleMessage}</p>}
        {googleResults.length > 0 && <div className="google-results">
          {googleResults.map(place => <article className="google-result-card" key={place.id}>
            <div className="google-result-copy"><strong>{place.displayName}</strong><span>{place.formattedAddress}</span><a href={place.googleMapsUri} target="_blank" rel="noreferrer">在 Google Maps 查看 ↗</a></div>
            <button type="button" className="outline small" onClick={() => chooseGooglePlace(place)}>選取</button>
          </article>)}
          <div className="google-attribution" translate="no">Google Maps</div>
        </div>}
      </section>
      {showSaveForm && <form id="save-collection-form" className="panel form-grid" onSubmit={saveCollection}>
        <div className="full-width"><h3>{editingId ? (collectionScope === "food_drink" ? "編輯吃喝收藏" : "編輯旅行行程收藏") : (collectionScope === "food_drink" ? "新增吃喝收藏" : "新增一筆旅行行程收藏")}</h3><p className="muted small-text">選取 Google Maps 地點後，國家、縣市、可辨識的區域及地址會自動帶入供即時確認。Google Maps 地點資料僅供即時確認，資料庫只保存 Google Place ID。</p></div>
        {selectedGooglePlace && <div className="full-width google-selected"><strong>已選取 Google Maps 地點</strong><span className="google-source-label">Google Maps 原始店名（即時資料）</span><span className="google-source-name">{selectedGooglePlace.displayName}</span><span className="muted small-text">{selectedGooglePlace.formattedAddress}</span>{googleMunicipality && <span className="muted small-text">市町村／行政區：{googleMunicipality}</span>}<a href={selectedGooglePlace.googleMapsUri} target="_blank" rel="noreferrer">Google Maps ↗</a><p className="tiny muted">上方名稱與地址來自 Google Maps，即時顯示供你核對；資料庫只保存 Google Place ID。</p></div>}
        {googlePlaceId && !selectedGooglePlace && <div className="full-width google-selected"><span>這筆收藏已連結 Google Maps 地點。</span></div>}
        <label>我的收藏名稱 *<input required value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="輸入你想在收藏清單顯示的名稱"/>{selectedGooglePlace && <span className="location-hint">上方是 Google Maps 原始店名；這裡填寫你自己的收藏名稱，可自由修改。</span>}</label>
        {collectionScope === "travel" && <>
          <label>所屬旅行<select value={selectedTrip} onChange={e => { setSelectedTrip(e.target.value); setItineraryDay(""); }}><option value="all">暫不指定／全部收藏</option>{trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
          {selectedTrip !== "all" && <label>安排在第幾天
            <select value={itineraryDay} onChange={e => setItineraryDay(e.target.value)} disabled={!trips.find(t => t.id === selectedTrip)?.duration_days}>
              <option value="">尚未安排日期</option>
              {Array.from({ length: trips.find(t => t.id === selectedTrip)?.duration_days || 0 }, (_, index) => index + 1).map(day => <option key={day} value={String(day)}>第 {day} 天</option>)}
            </select>
            {!trips.find(t => t.id === selectedTrip)?.duration_days && <span className="location-hint">這個旅行尚未設定天數，請在新增旅行時設定行程天數與夜數。</span>}
          </label>}
        </>}
        <label>國家
          <select value={placeCountryCustom ? "__custom__" : placeCountry} onChange={e => {
            if (e.target.value === "__custom__") { setPlaceCountry(""); setPlaceCountryCustom(true); }
            else { setPlaceCountry(e.target.value); setPlaceCountryCustom(false); }
            setPlaceCity(""); setPlaceRegion(""); setPlaceCityCustom(false); setPlaceRegionCustom(false);
          }}>
            <option value="">請選擇國家</option>
            {placeCountry && !COUNTRY_OPTIONS.includes(placeCountry) && <option value={placeCountry}>{placeCountry}（既有資料）</option>}
            {COUNTRY_OPTIONS.map(country => <option key={country} value={country}>{country}</option>)}
            <option value="__custom__">其他／自行輸入</option>
          </select>
          {placeCountryCustom && <input value={placeCountry} onChange={e => setPlaceCountry(e.target.value)} placeholder="請輸入國家名稱" />}
        </label>
        <label>城市／縣市
          {!placeCountryCustom && placeCityOptions.length > 0 && !placeCityCustom ? <select value={placeCity} onChange={e => {
            if (e.target.value === "__custom__") { setPlaceCity(""); setPlaceCityCustom(true); }
            else { setPlaceCity(e.target.value); setPlaceRegion(""); setPlaceRegionCustom(false); }
          }}>
            <option value="">請先選擇國家，再選城市／縣市</option>
            {placeCity && !placeCityOptions.includes(placeCity) && <option value={placeCity}>{placeCity}（既有資料）</option>}
            {placeCityOptions.map(city => <option key={city} value={city}>{city}</option>)}
            <option value="__custom__">其他／自行輸入</option>
          </select> : <input value={placeCity} onChange={e => { setPlaceCity(e.target.value); setPlaceRegion(""); }} placeholder="請輸入城市／縣市" />}
        </label>
        <label>區域
          {!placeCountryCustom && !placeCityCustom && placeRegionOptions.length > 0 && !placeRegionCustom ? <select value={placeRegion} onChange={e => {
            if (e.target.value === "__custom__") { setPlaceRegion(""); setPlaceRegionCustom(true); }
            else setPlaceRegion(e.target.value);
          }}>
            <option value="">請選擇區域</option>
            {placeRegion && !placeRegionOptions.includes(placeRegion) && <option value={placeRegion}>{placeRegion}（既有資料）</option>}
            {placeRegionOptions.map(region => <option key={region} value={region}>{region}</option>)}
            <option value="__custom__">其他／自行輸入</option>
          </select> : <input value={placeRegion} onChange={e => setPlaceRegion(e.target.value)} placeholder="請輸入區域／行政區" />}
          {!placeCountryCustom && !placeCityCustom && placeCity && placeRegionOptions.length === 0 && <span className="location-hint">此城市目前沒有預設區域清單，可自行輸入行政區或地區。</span>}
        </label>
        <label>分類<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <div className="full-width visit-tracker">
          <label className="visited-toggle"><input type="checkbox" checked={visited} onChange={e => setVisited(e.target.checked)} /> 已去過</label>
          <label className="experience-rating-label">{EXPERIENCE_RATINGS[category]?.question || "整體體驗如何？"}
            <select value={experienceRating} onChange={e => setExperienceRating(e.target.value)} disabled={!visited}>
              <option value="">請選擇評價</option>
              {(EXPERIENCE_RATINGS[category]?.options || EXPERIENCE_RATINGS["其他"].options).map((option, index) => <option key={option} value={String(4 - index)}>{option}</option>)}
            </select>
            {!visited && <span className="location-hint">勾選「已去過」後，就可以留下體驗評價。</span>}
          </label>
        </div>
        <label className="full-width">地址（選取 Google Maps 地點時自動帶入）<input value={address} onChange={e => setAddress(e.target.value)} placeholder="可稍後補上"/></label>
        <label className="full-width">原始貼文網址<input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..."/></label>
        <label className="full-width">備註<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="想吃什麼、注意事項、推薦原因…"/></label>
        <label className="full-width">貼文圖片／截圖<input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}/></label>
        <div className="form-actions"><button className="primary" disabled={busy}>{busy ? "儲存中…" : editingId ? "儲存修改" : "儲存收藏"}</button><button type="button" className="outline" onClick={() => { setShowSaveForm(false); setEditingId(null); setExistingImagePath(null); setImageFile(null); setPlaceCountryCustom(false); setPlaceCityCustom(false); setPlaceRegionCustom(false); }}>取消</button></div>
      </form>}

      <div className="toolbar"><input className="search" value={activePage === "food_drink" ? foodDrinkSearch : search} onChange={e => activePage === "food_drink" ? setFoodDrinkSearch(e.target.value) : setSearch(e.target.value)} placeholder={activePage === "food_drink" ? "⌕ 搜尋餐廳、咖啡店、類型…" : "⌕ 搜尋店家、城市、分類…"}/><span className="muted small-text">共 {activePage === "food_drink" ? filteredFoodDrink.length : filtered.length} 筆</span></div>
      {(activePage === "food_drink" ? filteredFoodDrink : filtered).length === 0 ? <div className="empty"><div>{activePage === "food_drink" ? "☕" : "⌖"}</div><h3>{activePage === "food_drink" ? "還沒有吃喝收藏" : "還沒有旅行行程收藏"}</h3><p className="muted">{activePage === "food_drink" ? "把平常想吃的餐廳、咖啡店與飲料店收藏在這裡。" : "把旅行中想去的地方收藏起來，再安排到每天行程。"}</p><button className="primary" onClick={() => setShowSaveForm(true)}>{activePage === "food_drink" ? "新增第一筆吃喝收藏" : "新增第一筆行程收藏"}</button></div> :
        <div className="collection-grid">{(activePage === "food_drink" ? filteredFoodDrink : filtered).map(item => <article className="place-card" key={item.id}>
          {(item as Collection & { image_url?: string | null }).image_url
            ? <img className="place-image" src={(item as Collection & { image_url?: string | null }).image_url || ""} alt={item.place_name}/>
            : item.google_place_id
              ? <GoogleMapsPlacePhoto placeId={item.google_place_id} placeName={item.place_name}/>
              : <div className="image-placeholder">✧</div>}
          <div className="place-body">
            <div className="place-card-heading">
              <div className="place-card-heading-main">
                <div className="place-meta"><span>{item.category}</span><span>{[item.country, item.city, item.region].filter(Boolean).join(" · ")}</span>{item.collection_scope === "travel" && item.itinerary_day && <span className="itinerary-day-chip">第 {item.itinerary_day} 天</span>}</div>
                <h3>{item.place_name}</h3>
              </div>
              <div className="card-visit-controls">
                <label className="card-visited-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(item.visited)}
                    disabled={inlineSavingIds.includes(item.id)}
                    onChange={event => updateInlineVisit(item, event.target.checked, event.target.checked ? item.experience_rating : null)}
                    aria-label={item.place_name + " 已去過"}
                  />
                  <span>已去過</span>
                </label>
                <select
                  className="card-rating-select"
                  value={item.experience_rating ? String(item.experience_rating) : ""}
                  disabled={!item.visited || inlineSavingIds.includes(item.id)}
                  onChange={event => updateInlineVisit(item, true, event.target.value ? Number(event.target.value) : null)}
                  aria-label={EXPERIENCE_RATINGS[item.category]?.question || "整體體驗評價"}
                  title={!item.visited ? "先勾選已去過，再留下評價" : EXPERIENCE_RATINGS[item.category]?.question}
                >
                  <option value="">{item.visited ? "選擇評價" : "尚未去過"}</option>
                  {(EXPERIENCE_RATINGS[item.category]?.options || EXPERIENCE_RATINGS["其他"].options).map((option, index) => (
                    <option key={option} value={String(4 - index)}>{option}</option>
                  ))}
                </select>
                {inlineSavingIds.includes(item.id) && <span className="card-save-state">儲存中…</span>}
              </div>
            </div>
            {item.address && <p className="muted small-text">{item.address}</p>}{item.notes && <p className="notes">{item.notes}</p>}
            <div className="place-actions">{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">查看原始貼文 ↗</a>}{item.google_place_id && <a href={getGoogleMapsPlaceUrl(item.place_name, item.google_place_id)} target="_blank" rel="noreferrer">Google Maps ↗</a>}<span className="action-group"><button className="edit-link" onClick={() => editCollection(item)}>編輯</button><button className="danger-link" onClick={() => deleteCollection(item.id)}>刪除</button></span></div>
            {item.google_place_id && <div className="google-live-block">
              <button type="button" className="outline small" disabled={googleDetailsBusyId === item.google_place_id} onClick={async () => {
                const placeId = item.google_place_id as string;
                if (expandedGooglePlaceId === placeId) { setExpandedGooglePlaceId(null); return; }
                setExpandedGooglePlaceId(placeId);
                if (!googleDetailsCache[placeId]) await fetchGooglePlaceDetails(placeId);
              }}>{googleDetailsBusyId === item.google_place_id ? "查詢中…" : expandedGooglePlaceId === item.google_place_id ? "隱藏即時地點資料" : "顯示 Google Maps 即時地點資料"}</button>
              {expandedGooglePlaceId === item.google_place_id && googleDetailsCache[item.google_place_id] && <div className="google-selected">
                <strong>Google Maps 即時辨識</strong>
                <span>{googleDetailsCache[item.google_place_id].displayName}</span>
                <span className="muted small-text">{[normalizeGoogleLocation(googleDetailsCache[item.google_place_id]).country, normalizeGoogleLocation(googleDetailsCache[item.google_place_id]).city, normalizeGoogleLocation(googleDetailsCache[item.google_place_id]).municipality, normalizeGoogleLocation(googleDetailsCache[item.google_place_id]).region].filter(Boolean).join(" · ")}</span>
                <span className="muted small-text">{googleDetailsCache[item.google_place_id].formattedAddress}</span>
                <span className="google-attribution" translate="no">Google Maps</span>
              </div>}
            </div>}
          </div>
        </article>)}</div>}
      </>}

      {activePage === "shopping" && <section className="shopping-page">
        <section className="section-heading collection-heading">
          <div><p className="eyebrow">TRAVEL SHOPPING</p><h2>購物清單</h2></div>
          <button className="primary" onClick={() => shoppingFormOpen ? setShoppingFormOpen(false) : startShoppingItem()}>{shoppingFormOpen ? "收起表單" : "＋ 新增項目"}</button>
        </section>
        <p className="muted small-text shopping-intro">把旅途中想買的商品先記下來，記錄數量、預算與實際花費；勾選已購買後，家庭成員也會同步看到。</p>

        <div className="shopping-summary">
          <div className="shopping-summary-stat"><strong>{filteredShoppingItems.length}</strong><span>清單項目</span></div>
          <div className="shopping-summary-stat"><strong>{filteredShoppingItems.filter(item => item.purchased).length}</strong><span>已購買</span></div>
          <div className="shopping-summary-totals">
            {shoppingTotals.length === 0 ? <span className="muted small-text">尚無金額紀錄</span> : shoppingTotals.map(total => (
              <div className="shopping-total-line" key={total.currency}>
                <span>{total.currency}</span>
                <span>預估 {formatShoppingMoney(total.hasEstimated ? total.estimated : null, total.currency)}</span>
                <span>實際 {formatShoppingMoney(total.hasActual ? total.actual : null, total.currency)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="shopping-toolbar">
          <input className="search" value={shoppingSearch} onChange={event => setShoppingSearch(event.target.value)} placeholder="⌕ 搜尋商品、分類、備註…" aria-label="搜尋購物項目"/>
          <label className="shopping-trip-filter">所屬旅行
            <select value={selectedTrip} onChange={event => setSelectedTrip(event.target.value)}>
              <option value="all">全部旅行</option>
              {trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}
            </select>
          </label>
        </div>

        {shoppingFormOpen && <form className="panel form-grid shopping-form" onSubmit={saveShoppingItem}>
          <div className="full-width"><h3>{shoppingEditingId ? "編輯購物項目" : "新增購物項目"}</h3><p className="muted small-text">預估與實際價格都是單件／單位價格，系統會依數量計算小計。</p></div>
          <label>商品／物品名稱 *<input required maxLength={200} value={shoppingName} onChange={event => setShoppingName(event.target.value)} placeholder="例如：防曬乳、伴手禮、球鞋"/></label>
          <label>購買店家（選填）<input value={shoppingStoreName} onChange={event => setShoppingStoreName(event.target.value)} placeholder="例如：唐吉訶德、Outlet"/></label>
          <label>商品網址（選填）<input type="url" value={shoppingProductUrl} onChange={event => setShoppingProductUrl(event.target.value)} placeholder="https://..."/></label>
          <label>分類<select value={shoppingCategory} onChange={event => setShoppingCategory(event.target.value)}>{SHOPPING_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>所屬旅行<select value={shoppingTripId} onChange={event => setShoppingTripId(event.target.value)}><option value="all">暫不指定／全部清單</option>{trips.map(trip => <option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
          <div className="shopping-quantity-row">
            <label>數量<input type="number" min="0.01" step="0.01" required value={shoppingQuantity} onChange={event => setShoppingQuantity(event.target.value)}/></label>
            <label>單位（選填）<input value={shoppingUnit} onChange={event => setShoppingUnit(event.target.value)} placeholder="個、瓶、盒"/></label>
          </div>
          <label>幣別<select value={shoppingCurrency} onChange={event => setShoppingCurrency(event.target.value)}>{SHOPPING_CURRENCIES.map(currency => <option key={currency.code} value={currency.code}>{currency.label}</option>)}</select></label>
          <label>預估單價<input type="number" min="0" step="0.01" value={shoppingEstimatedPrice} onChange={event => setShoppingEstimatedPrice(event.target.value)} placeholder="可先留空"/></label>
          <label>實際單價<input type="number" min="0" step="0.01" value={shoppingActualPrice} onChange={event => setShoppingActualPrice(event.target.value)} placeholder="購買後再填寫"/></label>
          <label className="full-width">備註<textarea value={shoppingNotes} onChange={event => setShoppingNotes(event.target.value)} placeholder="品牌、規格、購買地點、送給誰…"/></label>
          <div className="form-actions"><button className="primary" disabled={shoppingBusy}>{shoppingBusy ? "儲存中…" : shoppingEditingId ? "儲存修改" : "新增購物項目"}</button><button type="button" className="outline" onClick={() => { setShoppingFormOpen(false); resetShoppingForm(); }}>取消</button></div>
        </form>}

        {filteredShoppingItems.length === 0 ? (
          <div className="empty"><div>🛍</div><h3>{shoppingSearch ? "找不到符合的購物項目" : "購物清單還是空的"}</h3><p className="muted">先把旅行中想買的東西記下來，之後再慢慢補上價格與購買狀態。</p><button className="primary" onClick={startShoppingItem}>新增第一個項目</button></div>
        ) : (
          <div className="shopping-list">
            {filteredShoppingItems.map(item => {
              const quantity = Number(item.quantity || 0);
              const tripTitle = trips.find(trip => trip.id === item.trip_id)?.title;
              const estimatedSubtotal = item.estimated_price === null ? null : quantity * Number(item.estimated_price);
              const actualSubtotal = item.actual_price === null ? null : quantity * Number(item.actual_price);
              return <article className={item.purchased ? "shopping-item-card purchased" : "shopping-item-card"} key={item.id}>
                <div className="shopping-item-header">
                  <label className="shopping-purchased-toggle">
                    <input type="checkbox" checked={item.purchased} onChange={event => toggleShoppingPurchased(item, event.target.checked)} aria-label={item.item_name + " 已購買"}/>
                    <span>{item.purchased ? "已購買" : "尚未購買"}</span>
                  </label>
                  <div className="shopping-item-actions">
                    <button type="button" className="edit-link" onClick={() => editShoppingItem(item)}>編輯</button>
                    <button type="button" className="danger-link" onClick={() => deleteShoppingItem(item)}>刪除</button>
                  </div>
                </div>
                <h3 className="shopping-item-name">{item.item_name}</h3>
                <div className="shopping-item-meta"><span>{item.category}</span><span>{tripTitle || "未指定旅行"}</span><span>數量：{quantity}{item.unit || ""}</span>{item.store_name && <span>店家：{item.store_name}</span>}</div>
                {item.product_url && <p className="shopping-product-link"><a href={item.product_url} target="_blank" rel="noreferrer">查看商品連結 ↗</a></p>}
                <div className="shopping-price-grid">
                  <div><span>預估小計</span><strong>{formatShoppingMoney(estimatedSubtotal, item.currency)}</strong></div>
                  <div><span>實際小計</span><strong>{formatShoppingMoney(actualSubtotal, item.currency)}</strong></div>
                </div>
                {item.notes && <p className="shopping-item-notes">{item.notes}</p>}
              </article>;
            })}
          </div>
        )}
      </section>}

      <footer>MY TRAVEL · YOUR PLACES, YOUR JOURNEYS · <a href="/terms">使用條款</a> · <a href="/privacy">隱私權政策</a></footer>
    </main>
  );
}