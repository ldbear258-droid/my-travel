"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

type Trip = { id: string; title: string; country: string | null; city: string | null; start_date: string | null; end_date: string | null; created_at: string };
type Collection = { id: string; trip_id: string | null; place_name: string; country: string | null; city: string | null; region: string | null; category: string; address: string | null; source_url: string | null; notes: string | null; image_path: string | null; created_at: string };

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
    if (result.error) setMessage("登入失敗，請確認家庭共用帳號的電子郵件與密碼。");
    else setMessage("登入成功。");
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
    const duplicate = items.find(x => x.place_name.trim().toLocaleLowerCase() === placeName.trim().toLocaleLowerCase() && (x.address || "").trim().toLocaleLowerCase() === address.trim().toLocaleLowerCase());
    let image_path: string | null = null;
    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${session.user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("collection-media").upload(path, imageFile, { upsert: false });
      if (uploadError) { setBusy(false); setMessage("圖片上傳失敗：" + uploadError.message); return; }
      image_path = path;
    }
    const { error } = await supabase.from("collections").insert({
      user_id: session.user.id, trip_id: selectedTrip === "all" ? null : selectedTrip,
      place_name: placeName.trim(), country: placeCountry || null, city: placeCity || null,
      region: placeRegion || null, category, address: address || null, source_url: sourceUrl || null,
      notes: notes || null, image_path
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setPlaceName(""); setPlaceCountry(""); setPlaceCity(""); setPlaceRegion(""); setAddress(""); setSourceUrl(""); setNotes(""); setImageFile(null);
      setShowSaveForm(false); setMessage(duplicate ? "已新增收藏。提醒：找到名稱及地址相同的既有收藏，請確認是否重複。" : "收藏成功！");
      loadData();
    }
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
        <p className="tiny muted">家庭共用帳號 · 僅限家人使用</p>
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
        <div><p className="eyebrow">YOUR PERSONAL TRAVEL LIBRARY</p><h1>把喜歡的地方，<br/>都收藏起來。</h1><p className="muted">每一次收藏，都是下一趟旅行的靈感。</p></div>
        <div className="hero-stats"><div><strong>{trips.length}</strong><span>旅行專案</span></div><div><strong>{items.length}</strong><span>收藏地點</span></div></div>
      </section>

      {message && <div className="notice global-notice">{message}<button onClick={() => setMessage("")}>×</button></div>}

      <section className="section-heading"><div><p className="eyebrow">TRAVEL COLLECTIONS</p><h2>我的旅行</h2></div><button className="primary" onClick={() => setShowTripForm(!showTripForm)}>＋ 新增旅行</button></section>
      {showTripForm && <form className="panel form-grid" onSubmit={createTrip}>
        <label>旅行名稱<input required value={tripTitle} onChange={e => setTripTitle(e.target.value)} placeholder="例如：沖繩五天四夜"/></label>
        <label>國家<input value={tripCountry} onChange={e => setTripCountry(e.target.value)} placeholder="日本"/></label>
        <label>城市／地區<input value={tripCity} onChange={e => setTripCity(e.target.value)} placeholder="沖繩"/></label>
        <div className="form-actions"><button className="primary" disabled={busy}>儲存專案</button><button type="button" className="outline" onClick={() => setShowTripForm(false)}>取消</button></div>
      </form>}
      <div className="trip-grid">
        <button className={`trip-card all-card ${selectedTrip === "all" ? "selected" : ""}`} onClick={() => setSelectedTrip("all")}><span className="trip-icon">✧</span><strong>全部收藏</strong><span>{items.length} 個地點</span></button>
        {trips.map(trip => <button key={trip.id} className={`trip-card ${selectedTrip === trip.id ? "selected" : ""}`} onClick={() => setSelectedTrip(trip.id)}>
          <span className="trip-icon">⌁</span><strong>{trip.title}</strong><span>{[trip.country, trip.city].filter(Boolean).join(" · ") || "尚未設定地區"}</span>
          <small>{items.filter(x => x.trip_id === trip.id).length} 個收藏</small>
        </button>)}
      </div>

      <section className="section-heading collection-heading"><div><p className="eyebrow">SAVED PLACES</p><h2>收藏清單</h2></div><button className="primary" onClick={() => setShowSaveForm(!showSaveForm)}>＋ 新增收藏</button></section>
      {showSaveForm && <form className="panel form-grid" onSubmit={saveCollection}>
        <div className="full-width"><h3>新增一筆旅行收藏</h3><p className="muted small-text">第一版先手動確認資料；AI 自動辨識及分享接收將在下一個版本串接。</p></div>
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
        <div className="form-actions"><button className="primary" disabled={busy}>{busy ? "儲存中…" : "儲存收藏"}</button><button type="button" className="outline" onClick={() => setShowSaveForm(false)}>取消</button></div>
      </form>}

      <div className="toolbar"><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="⌕ 搜尋店家、城市、分類…"/><span className="muted small-text">共 {filtered.length} 筆</span></div>
      {filtered.length === 0 ? <div className="empty"><div>⌖</div><h3>還沒有收藏地點</h3><p className="muted">把看到的好地方先收藏起來，慢慢建立你的旅行資料庫。</p><button className="primary" onClick={() => setShowSaveForm(true)}>新增第一筆收藏</button></div> :
        <div className="collection-grid">{filtered.map(item => <article className="place-card" key={item.id}>
          {(item as Collection & { image_url?: string | null }).image_url ? <img className="place-image" src={(item as Collection & { image_url?: string | null }).image_url || ""} alt={item.place_name}/> : <div className="image-placeholder">✧</div>}
          <div className="place-body"><div className="place-meta"><span>{item.category}</span><span>{[item.country, item.city, item.region].filter(Boolean).join(" · ")}</span></div>
            <h3>{item.place_name}</h3>{item.address && <p className="muted small-text">{item.address}</p>}{item.notes && <p className="notes">{item.notes}</p>}
            <div className="place-actions">{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">查看原始貼文 ↗</a>}<button className="danger-link" onClick={() => deleteCollection(item.id)}>刪除</button></div>
          </div>
        </article>)}</div>}
      <footer>MY TRAVEL · YOUR PLACES, YOUR JOURNEYS</footer>
    </main>
  );
}