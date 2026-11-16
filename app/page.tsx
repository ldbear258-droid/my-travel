"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Trip = { id: string; title: string; country: string | null; city: string | null; start_date: string | null; end_date: string | null; created_at: string };
type Collection = { id: string; trip_id: string | null; place_name: string; country: string | null; city: string | null; region: string | null; category: string; address: string | null; source_url: string | null; notes: string | null; image_path: string | null; google_place_id: string | null; created_at: string; image_url?: string | null };
type GooglePlace = { id: string; displayName: string; formattedAddress: string; googleMapsUri: string };

const categories = ["景點", "美食", "購物", "住宿", "交通", "其他"];
const supabase = getSupabase();

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [items, setItems] = useState<Collection[]>([]);
  const [selectedTrip, setSelectedTrip] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTripForm, setShowTripForm] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [tripTitle, setTripTitle] = useState("");
  const [tripCountry, setTripCountry] = useState("");
  const [tripCity, setTripCity] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeCountry, setPlaceCountry] = useState("");
  const [placeCity, setPlaceCity] = useState("");
  const [placeRegion, setPlaceRegion] = useState("");
  const [category, setCategory] = useState("景點");
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadData();
  }, [session?.user?.id]);

  async function loadData() {
    const [{ data: tripData, error: tripError }, { data: collectionData, error: collectionError }] = await Promise.all([
      supabase.from("trips").select("*").order("created_at", { ascending: false }),
      supabase.from("collections").select("*").order("created_at", { ascending: false }),
    ]);
    if (tripError || collectionError) {
      setMessage(tripError?.message || collectionError?.message || "讀取資料失敗");
      return;
    }
    setTrips((tripData || []) as Trip[]);
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
    else setMessage("登入成功。");
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

  function startNewCollection() {
    setEditingId(null); setExistingImagePath(null); setPlaceName(""); setPlaceCountry(""); setPlaceCity("");
    setPlaceRegion(""); setCategory("景點"); setAddress(""); setSourceUrl(""); setNotes(""); setImageFile(null);
    setGooglePlaceId(null); setSelectedGooglePlace(null); setShowSaveForm(true);
  }

  function chooseGooglePlace(place: GooglePlace) {
    startNewCollection();
    setGooglePlaceId(place.id);
    setSelectedGooglePlace(place);
    // Keep the user's own search phrase as the saved label; Google Places content is not copied into the database.
    setPlaceName(googleQuery.trim());
    setGoogleMessage("");
    setMessage("已選取 Google Maps 地點。請確認下方收藏名稱及分類，再儲存。");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function createTrip(e: FormEvent) {
    e.preventDefault(); if (!session) return;
    setBusy(true);
    const { error } = await supabase.from("trips").insert({ user_id: session.user.id, title: tripTitle, country: tripCountry || null, city: tripCity || null });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setTripTitle(""); setTripCountry(""); setTripCity(""); setShowTripForm(false); setMessage("旅行專案已建立"); loadData(); }
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
    const payload = {
      trip_id: selectedTrip === "all" ? null : selectedTrip,
      place_name: placeName.trim(), country: placeCountry || null, city: placeCity || null,
      region: placeRegion || null, category, address: address || null, source_url: sourceUrl || null,
      notes: notes || null, image_path, google_place_id: googlePlaceId
    };
    const result = editingId
      ? await supabase.from("collections").update(payload).eq("id", editingId)
      : await supabase.from("collections").insert({ ...payload, user_id: session.user.id });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else {
      setPlaceName(""); setPlaceCountry(""); setPlaceCity(""); setPlaceRegion(""); setAddress(""); setSourceUrl(""); setNotes(""); setImageFile(null);
      setEditingId(null); setExistingImagePath(null); setGooglePlaceId(null); setSelectedGooglePlace(null); setShowSaveForm(false);
      setMessage(editingId ? "收藏已更新，家庭成員都能看到。" : duplicate ? "已新增收藏。提醒：找到名稱及地址相同的既有收藏，請確認是否重複。" : "收藏成功，已加入家庭共用清單！");
      loadData();
    }
  }

  function editCollection(item: Collection) {
    setEditingId(item.id);
    setExistingImagePath(item.image_path);
    setGooglePlaceId(item.google_place_id || null);
    setSelectedGooglePlace(null);
    setPlaceName(item.place_name);
    setPlaceCountry(item.country || "");
    setPlaceCity(item.city || "");
    setPlaceRegion(item.region || "");
    setCategory(item.category);
    setAddress(item.address || "");
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
    setMessage(`旅行「${trip.title}」已刪除；原有收藏已保留在「全部收藏」。`);
    await loadData();
  }

  async function deleteCollection(id: string) {
    if (!confirm("確定刪除這筆收藏？")) return;
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) setMessage(error.message); else { setMessage("已刪除收藏"); loadData(); }
  }

  async function signOut() { await supabase.auth.signOut(); setTrips([]); setItems([]); }

  const filtered = useMemo(() => items.filter(item => {
    const matchesTrip = selectedTrip === "all" || item.trip_id === selectedTrip;
    const haystack = [item.place_name, item.country, item.city, item.region, item.category, item.address].join(" ").toLowerCase();
    return matchesTrip && haystack.includes(search.toLowerCase());
  }), [items, selectedTrip, search]);

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
        <label>國家<input value={tripCountry} onChange={e => setTripCountry(e.target.value)} placeholder="日本"/></label>
        <label>城市／地區<input value={tripCity} onChange={e => setTripCity(e.target.value)} placeholder="沖繩"/></label>
        <div className="form-actions"><button className="primary" disabled={busy}>儲存專案</button><button type="button" className="outline" onClick={() => setShowTripForm(false)}>取消</button></div>
      </form>}
      <div className="trip-grid">
        <button className={`trip-card all-card ${selectedTrip === "all" ? "selected" : ""}`} onClick={() => setSelectedTrip("all")}><span className="trip-icon">✧</span><strong>全部收藏</strong><span>{items.length} 個地點</span></button>
        {trips.map(trip => <div key={trip.id} className="trip-card-wrap">
          <button className={`trip-card ${selectedTrip === trip.id ? "selected" : ""}`} onClick={() => setSelectedTrip(trip.id)}>
            <span className="trip-icon">⌁</span><strong>{trip.title}</strong><span>{[trip.country, trip.city].filter(Boolean).join(" · ") || "尚未設定地區"}</span>
            <small>{items.filter(x => x.trip_id === trip.id).length} 個收藏</small>
          </button>
          <button type="button" className="trip-delete-btn" disabled={busy} onClick={() => deleteTrip(trip)} aria-label={`刪除旅行 ${trip.title}`} title="刪除旅行">刪除</button>
        </div>)}
      </div>

      <section className="section-heading collection-heading"><div><p className="eyebrow">SAVED PLACES</p><h2>收藏清單</h2></div><button className="primary" onClick={() => showSaveForm ? setShowSaveForm(false) : startNewCollection()}>{showSaveForm ? "收起表單" : "＋ 新增收藏"}</button></section>
      <section className="google-search-panel">
        <div><p className="eyebrow">FIND A PLACE</p><h3>從 Google Maps 搜尋店家</h3><p className="muted small-text">輸入店名、景點或城市，例如「A&W 牧港店」或「沖繩水族館」。</p></div>
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
      {showSaveForm && <form className="panel form-grid" onSubmit={saveCollection}>
        <div className="full-width"><h3>{editingId ? "編輯旅行收藏" : "新增一筆旅行收藏"}</h3><p className="muted small-text">收藏名稱、分類、備註及地址由你自行確認與填寫。Google Maps 搜尋結果只供即時參考；My Travel 僅保存 Google Place ID，並提供地圖連結。</p></div>
        {selectedGooglePlace && <div className="full-width google-selected"><strong>已選取 Google Maps 地點</strong><span>{selectedGooglePlace.displayName}</span><span className="muted small-text">{selectedGooglePlace.formattedAddress}</span><a href={selectedGooglePlace.googleMapsUri} target="_blank" rel="noreferrer">Google Maps ↗</a><p className="tiny muted">下方收藏名稱會使用你輸入的搜尋文字；可自行修改成自己的收藏名稱。</p></div>}
        {googlePlaceId && !selectedGooglePlace && <div className="full-width google-selected"><span>這筆收藏已連結 Google Maps 地點。</span></div>}
        <label>地點／店家名稱 *<input required value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="例如：美麗海水族館"/></label>
        <label>所屬旅行<select value={selectedTrip} onChange={e => setSelectedTrip(e.target.value)}><option value="all">暫不指定／全部收藏</option>{trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label>國家<input value={placeCountry} onChange={e => setPlaceCountry(e.target.value)} placeholder="日本"/></label>
        <label>城市<input value={placeCity} onChange={e => setPlaceCity(e.target.value)} placeholder="沖繩"/></label>
        <label>區域<input value={placeRegion} onChange={e => setPlaceRegion(e.target.value)} placeholder="北部／中部／南部"/></label>
        <label>分類<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="full-width">地址<input value={address} onChange={e => setAddress(e.target.value)} placeholder="可稍後補上"/></label>
        <label className="full-width">原始貼文網址<input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..."/></label>
        <label className="full-width">備註<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="想吃什麼、注意事項、推薦原因…"/></label>
        <label className="full-width">貼文圖片／截圖<input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)}/></label>
        <div className="form-actions"><button className="primary" disabled={busy}>{busy ? "儲存中…" : editingId ? "儲存修改" : "儲存收藏"}</button><button type="button" className="outline" onClick={() => { setShowSaveForm(false); setEditingId(null); setExistingImagePath(null); setImageFile(null); }}>取消</button></div>
      </form>}

      <div className="toolbar"><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="⌕ 搜尋店家、城市、分類…"/><span className="muted small-text">共 {filtered.length} 筆</span></div>
      {filtered.length === 0 ? <div className="empty"><div>⌖</div><h3>還沒有收藏地點</h3><p className="muted">把看到的好地方先收藏起來，慢慢建立你的旅行資料庫。</p><button className="primary" onClick={() => setShowSaveForm(true)}>新增第一筆收藏</button></div> :
        <div className="collection-grid">{filtered.map(item => <article className="place-card" key={item.id}>
          {(item as Collection & { image_url?: string | null }).image_url ? <img className="place-image" src={(item as Collection & { image_url?: string | null }).image_url || ""} alt={item.place_name}/> : <div className="image-placeholder">✧</div>}
          <div className="place-body"><div className="place-meta"><span>{item.category}</span><span>{[item.country, item.city, item.region].filter(Boolean).join(" · ")}</span></div>
            <h3>{item.place_name}</h3>{item.address && <p className="muted small-text">{item.address}</p>}{item.notes && <p className="notes">{item.notes}</p>}
            <div className="place-actions">{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">查看原始貼文 ↗</a>}{item.google_place_id && <a href={"https://www.google.com/maps/search/?api=1&query_place_id=" + encodeURIComponent(item.google_place_id)} target="_blank" rel="noreferrer">Google Maps ↗</a>}<span className="action-group"><button className="edit-link" onClick={() => editCollection(item)}>編輯</button><button className="danger-link" onClick={() => deleteCollection(item.id)}>刪除</button></span></div>
          </div>
        </article>)}</div>}
      <footer>MY TRAVEL · YOUR PLACES, YOUR JOURNEYS · <a href="/terms">使用條款</a> · <a href="/privacy">隱私權政策</a></footer>
    </main>
  );
}