import { useEffect, useRef, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const request = async (path, options = {}, token) => {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "The spell failed.");
  return data;
};

function Auth({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const result = await request(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[#f1e4cd]">
      <section className="hidden lg:flex relative overflow-hidden flex-col justify-between p-16 text-[#f7e6c1] bg-[#271116]">
        <div className="absolute inset-5 border border-amber-300/30" />
        <p className="font-display text-lg z-10">⚄ PortAbleTrack</p>
        <div className="z-10 max-w-2xl">
          <p className="eyebrow">THE ADVENTURER'S LEDGER</p>
          <h1 className="font-display text-6xl leading-tight">
            Every legend begins
            <br />
            with a <i className="font-serif text-amber-300">single roll.</i>
          </h1>
          <p className="mt-6 max-w-md font-serif text-xl text-amber-100/80">
            A shared table for campaigns, character sheets, and the stories your
            party will remember.
          </p>
        </div>
        <p className="z-10 text-sm text-amber-200">
          ● The tavern doors are open
        </p>
      </section>
      <section className="flex items-center justify-center p-7">
        <form onSubmit={submit} className="w-full max-w-md">
          <p className="eyebrow">WELCOME, ADVENTURER</p>
          <h2 className="font-display text-4xl">
            {register ? "Begin your adventure" : "Enter the realm"}
          </h2>
          <p className="mt-3 text-stone-600">
            {register
              ? "Create your ledger and prepare for the first session."
              : "Return to your campaign and continue the tale."}
          </p>
          <div className="mt-8 flex gap-7 border-b border-amber-900/20 text-sm">
            <button
              type="button"
              onClick={() => setRegister(false)}
              className={!register ? "tab active" : "tab"}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setRegister(true)}
              className={register ? "tab active" : "tab"}
            >
              Join the guild
            </button>
          </div>
          {register && (
            <Field
              label="Adventurer name"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
            />
          )}
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(email) => setForm({ ...form, email })}
          />
          <Field
            label="Passphrase"
            type="password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
          />
          <button className="button mt-3">
            {register ? "Begin the quest" : "Enter the realm"} <span>→</span>
          </button>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        </form>
      </section>
    </main>
  );
}
function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="mt-5 block font-display text-xs tracking-wider text-stone-700">
      {label}
      <input
        required
        minLength={type === "password" ? 8 : undefined}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded border border-amber-900/25 bg-[#fff9ed] p-3 font-sans text-base font-normal outline-none focus:border-[#761b25]"
      />
    </label>
  );
}
function App() {
  const [session, setSession] = useState(() =>
    JSON.parse(localStorage.getItem("portabletrack_session") || "null"),
  );
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const campaignRequest = useRef(0);
  const token = session?.token;
  const loadCampaigns = async () => {
    try {
      const data = await request("/campaigns", {}, token);
      setCampaigns(data.campaigns);
      if (!selected && data.campaigns[0]) openCampaign(data.campaigns[0]._id);
    } catch (err) {
      setError(err.message);
    }
  };
  const openCampaign = async (id) => {
    const requestId = ++campaignRequest.current;
    try {
      const campaign = await request(`/campaigns/${id}`, {}, token);
      if (requestId === campaignRequest.current) setSelected(campaign);
    } catch (err) {
      if (requestId === campaignRequest.current) setError(err.message);
    }
  };
  useEffect(() => {
    if (token) loadCampaigns();
  }, [token]);
  const authenticated = (data) => {
    localStorage.setItem("portabletrack_session", JSON.stringify(data));
    setSession(data);
  };
  if (!session) return <Auth onAuthenticated={authenticated} />;
  return (
    <ChatRpgDashboard
      {...{
        session,
        campaigns,
        setCampaigns,
        selected,
        setSelected,
        error,
        setError,
        loadCampaigns,
        openCampaign,
      }}
      logout={() => {
        localStorage.removeItem("portabletrack_session");
        setSession(null);
      }}
    />
  );
}
function Dashboard({
  session,
  campaigns,
  setCampaigns,
  selected,
  setSelected,
  error,
  setError,
  loadCampaigns,
  openCampaign,
  logout,
}) {
  const token = session.token;
  const [newCampaign, setNewCampaign] = useState("");
  const [premise, setPremise] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const createCampaign = async (e) => {
    e.preventDefault();
    try {
      const { campaign } = await request(
        "/campaigns",
        {
          method: "POST",
          body: JSON.stringify({
            name: newCampaign,
            description:
              premise.trim() || "ผู้เล่นไม่ได้ระบุธีม ให้เลือกธีมที่น่าสนใจเอง",
          }),
        },
        token,
      );
      setNewCampaign("");
      setPremise("");
      await loadCampaigns();
      openCampaign(campaign._id);
    } catch (err) {
      setError(err.message);
    }
  };
  const send = async (e) => {
    e.preventDefault();
    if (!message.trim() || !selected) return;
    setLoading(true);
    try {
      const data = await request(
        `/campaigns/${selected.campaign._id}/dm`,
        { method: "POST", body: JSON.stringify({ message }) },
        token,
      );
      setSelected({
        ...selected,
        messages: [...selected.messages, ...data.messages],
      });
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const deleteCampaign = async (campaign) => {
    if (
      !window.confirm(
        `Delete campaign "${campaign.name}"? This cannot be undone.`,
      )
    )
      return;
    try {
      await request(`/campaigns/${campaign._id}`, { method: "DELETE" }, token);
      const remaining = campaigns.filter((item) => item._id !== campaign._id);
      setCampaigns(remaining);
      if (selected?.campaign._id === campaign._id) {
        setSelected(null);
        if (remaining[0]) openCampaign(remaining[0]._id);
      }
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <main className="min-h-screen bg-[#f3e7d1] text-[#2b1b1a]">
      <button
        type="button"
        onClick={() => selected && deleteCampaign(selected.campaign)}
        disabled={!selected}
        className="fixed bottom-5 left-5 z-10 rounded border border-[#761b25] bg-[#fff9ed] px-3 py-2 text-xs font-bold text-[#761b25] disabled:opacity-40"
      >
        Delete selected campaign
      </button>
      <header className="flex items-center justify-between border-b border-amber-900/20 bg-[#32141a] px-6 py-4 text-amber-50">
        <p className="font-display text-lg">
          ⚄ PortAbleTrack{" "}
          <span className="text-xs text-amber-200">Adventurer's Ledger</span>
        </p>
        <div className="flex items-center gap-4 text-sm">
          <span>{session.user.name}</span>
          <button onClick={logout} className="text-amber-200 hover:text-white">
            Leave realm
          </button>
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[280px_1fr_320px]">
        <aside className="border-r border-amber-900/15 p-5">
          <p className="eyebrow">CAMPAIGNS</p>
          <form onSubmit={createCampaign} className="mb-5">
            <input
              required
              value={newCampaign}
              onChange={(e) => setNewCampaign(e.target.value)}
              placeholder="New campaign"
              className="mb-2 min-w-0 w-full rounded border border-amber-900/20 bg-white/60 p-2 text-sm"
            />
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="Premise (optional): นักผจญภัยตามหาสมบัติในป่าต้องคำสาป"
              maxLength={5000}
              rows="3"
              className="mb-2 min-w-0 w-full resize-y rounded border border-amber-900/20 bg-white/60 p-2 text-sm"
            />
            <button className="w-full rounded bg-[#761b25] px-3 py-2 text-white">
              Create campaign
            </button>
          </form>
          {campaigns.map((campaign) => (
            <button
              key={campaign._id}
              onClick={() => openCampaign(campaign._id)}
              className={`mb-2 w-full rounded p-3 text-left text-sm ${selected?.campaign._id === campaign._id ? "bg-[#761b25] text-white" : "bg-white/40 hover:bg-white/70"}`}
            >
              <b>{campaign.name}</b>
              <br />
              <span className="text-xs opacity-70">
                {campaign.settings.system}
              </span>
            </button>
          ))}
        </aside>
        <section className="flex min-h-[600px] flex-col p-6 lg:min-h-[calc(100vh-65px)] lg:p-8">
          {selected ? (
            <>
              <div className="mb-6">
                <p className="eyebrow">
                  {selected.campaign.settings.system} · AI DUNGEON MASTER
                </p>
                <h1 className="font-display text-3xl">
                  {selected.campaign.name}
                </h1>
                <p className="mt-2 text-stone-600">
                  {selected.campaign.description}
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 lg:h-[calc(100vh-270px)] lg:flex-none">
                {selected.messages.length === 0 && (
                  <div className="rounded border border-dashed border-amber-900/30 p-6 font-serif text-lg text-stone-600">
                    The table is quiet. Describe the opening scene, or ask your
                    Dungeon Master to begin.
                  </div>
                )}
                {selected.messages.map((item) => (
                  <article
                    key={item._id}
                    className={`max-w-3xl rounded p-4 ${item.role === "dm" ? "bg-[#32141a] text-amber-50" : "ml-auto bg-white/65"}`}
                  >
                    <p className="mb-2 font-display text-[10px] tracking-widest text-amber-400">
                      {item.role === "dm" ? "DUNGEON MASTER" : "ADVENTURER"}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>
                  </article>
                ))}
              </div>
              <form onSubmit={send} className="mt-6 flex gap-3">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What does your character do?"
                  className="w-full rounded border border-amber-900/25 bg-[#fff9ed] p-3"
                />
                <button disabled={loading} className="button w-auto px-5">
                  {loading ? "Rolling…" : "Speak"}
                </button>
              </form>
            </>
          ) : (
            <div className="m-auto text-center">
              <h1 className="font-display text-3xl">Start a campaign</h1>
              <p className="mt-3 text-stone-600">
                Create your table to summon an AI Dungeon Master.
              </p>
            </div>
          )}
        </section>
        <CharacterPanel
          selected={selected}
          token={token}
          refresh={() => selected && openCampaign(selected.campaign._id)}
          onError={setError}
        />{" "}
      </div>
      {error && (
        <p className="fixed bottom-5 right-5 rounded bg-red-800 px-4 py-3 text-sm text-white">
          {error}
        </p>
      )}
    </main>
  );
}
function CharacterPanel({ selected, token, refresh, onError }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const sheetFileInput = useRef(null);
  const add = async (e) => {
    e.preventDefault();
    try {
      await request(
        `/campaigns/${selected.campaign._id}/characters`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            race: "Unknown",
            className: "Adventurer",
          }),
        },
        token,
      );
      setName("");
      refresh();
    } catch (err) {
      onError(err.message);
    }
  };
  const upload = async (character) => {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("sheet", file);
      await request(
        `/characters/${character._id}/sheet`,
        { method: "POST", body },
        token,
      );
      setFile(null);
      refresh();
    } catch (err) {
      onError(
        err.message.includes("Failed to fetch")
          ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ หรือ AI ใช้เวลานานเกินไป กรุณาลองใหม่"
          : err.message,
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <aside className="border-l border-amber-900/15 bg-[#ead8b9]/50 p-5">
      <p className="eyebrow">THE PARTY</p>
      {selected ? (
        <>
          <form onSubmit={add} className="mb-5 flex gap-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              className="min-w-0 w-full rounded border border-amber-900/20 bg-white/60 p-2 text-sm"
            />
            <button className="rounded bg-[#761b25] px-3 text-white">+</button>
          </form>
          <input
            onChange={(e) => setFile(e.target.files?.[0])}
            type="file"
            accept=".pdf,.txt,.json"
            className="mb-3 block w-full text-xs"
          />
          {selected.characters.map((character) => (
            <div
              key={character._id}
              className="mb-3 rounded border border-amber-900/15 bg-[#fff9ed]/70 p-3"
            >
              <b className="font-display text-sm">{character.name}</b>
              <p className="mt-1 text-xs text-stone-600">
                Level {character.level} {character.race} {character.className}
              </p>
              {character.sheet?.summary ? (
                <p className="mt-2 line-clamp-3 text-xs text-stone-600">
                  Sheet read: {character.sheet.fileName}
                </p>
              ) : (
                <button
                  disabled={!file || uploading}
                  onClick={() => upload(character)}
                  className="mt-3 text-xs font-bold text-[#761b25] disabled:text-stone-400"
                >
                  {uploading ? "Reading sheet…" : "Read selected sheet"}
                </button>
              )}
            </div>
          ))}
        </>
      ) : (
        <p className="text-sm text-stone-600">
          Choose a campaign to build the party.
        </p>
      )}
    </aside>
  );
}
function RpgDashboard({ session, campaigns, setCampaigns, selected, setSelected, error, setError, loadCampaigns, openCampaign, logout }) {
  const token = session.token;
  const [newCampaign, setNewCampaign] = useState("");
  const [premise, setPremise] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [partyOpen, setPartyOpen] = useState(true);

  const createCampaign = async (event) => {
    event.preventDefault();
    try {
      const { campaign } = await request("/campaigns", { method: "POST", body: JSON.stringify({ name: newCampaign, description: premise.trim() || "ผู้เล่นไม่ได้ระบุธีม ให้เลือกธีมที่น่าสนใจเอง" }) }, token);
      setNewCampaign(""); setPremise(""); await loadCampaigns(); openCampaign(campaign._id);
    } catch (err) { setError(err.message); }
  };
  const send = async (event) => {
    event.preventDefault();
    if (!message.trim() || !selected || loading) return;
    setLoading(true);
    try {
      const data = await request(`/campaigns/${selected.campaign._id}/dm`, { method: "POST", body: JSON.stringify({ message }) }, token);
      setSelected({ ...selected, messages: [...selected.messages, ...data.messages] }); setMessage("");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  const deleteCampaign = async () => {
    if (!selected || !window.confirm(`Delete campaign "${selected.campaign.name}"? This cannot be undone.`)) return;
    try {
      await request(`/campaigns/${selected.campaign._id}`, { method: "DELETE" }, token);
      const remaining = campaigns.filter((item) => item._id !== selected.campaign._id);
      setCampaigns(remaining); setSelected(null); if (remaining[0]) openCampaign(remaining[0]._id);
    } catch (err) { setError(err.message); }
  };
  const layout = `rpg-layout ${campaignsOpen ? "campaigns-open" : ""} ${partyOpen ? "party-open" : ""}`;

  return <main className="rpg-shell">
    <header className="rpg-topbar">
      <div className="rpg-brand"><span className="brand-mark">⚄</span><span>PortAbleTrack</span><small>ADVENTURER'S LEDGER</small></div>
      <div className="rpg-top-actions"><button className={`panel-switch ${campaignsOpen ? "is-active" : ""}`} onClick={() => setCampaignsOpen((open) => !open)}>☰ Campaigns</button><button className={`panel-switch ${partyOpen ? "is-active" : ""}`} onClick={() => setPartyOpen((open) => !open)}>♜ Party</button><span className="player-name">{session.user.name}</span><button onClick={logout} className="leave-button">Leave realm</button></div>
    </header>
    <div className={layout}>
      {campaignsOpen && <aside className="rpg-sidebar campaign-panel">
        <div className="panel-heading"><span>✦ CAMPAIGNS</span><button onClick={() => setCampaignsOpen(false)} aria-label="Collapse campaigns">‹</button></div>
        <form onSubmit={createCampaign} className="campaign-form">
          <input required value={newCampaign} onChange={(event) => setNewCampaign(event.target.value)} placeholder="Name your campaign" />
          <textarea value={premise} onChange={(event) => setPremise(event.target.value)} placeholder="A hook for the tale (optional)" maxLength={5000} rows="3" />
          <button className="rpg-button">Create campaign <span>→</span></button>
        </form>
        <div className="campaign-list">{campaigns.map((campaign) => <button key={campaign._id} onClick={() => openCampaign(campaign._id)} className={`campaign-card ${selected?.campaign._id === campaign._id ? "selected" : ""}`}><b>{campaign.name}</b><small>{campaign.settings.system}</small></button>)}</div>
        <button type="button" onClick={deleteCampaign} disabled={!selected} className="delete-button">Delete selected campaign</button>
      </aside>}
      <section className="rpg-table">
        {!campaignsOpen && <button className="restore-panel restore-left" onClick={() => setCampaignsOpen(true)}>☰ <span>Campaigns</span></button>}
        {!partyOpen && <button className="restore-panel restore-right" onClick={() => setPartyOpen(true)}><span>Character sheets</span> ♜</button>}
        {selected ? <>
          <div className="campaign-banner"><div><p>✦ {selected.campaign.settings.system} · AI DUNGEON MASTER</p><h1>{selected.campaign.name}</h1><span>{selected.campaign.description}</span></div><div className="table-status"><i /> DM is at the table</div></div>
          <div className="chat-scroll">{selected.messages.length === 0 && <div className="empty-table"><span>✦</span><h2>The table awaits</h2><p>Describe the opening scene, or invite the Dungeon Master to begin.</p></div>}{selected.messages.map((item) => <article key={item._id} className={`chat-card ${item.role === "dm" ? "dm-card" : "player-card"}`}><div className="message-label">{item.role === "dm" ? "✦ DUNGEON MASTER" : "◈ ADVENTURER"}</div><p>{item.content}</p></article>)}{loading && <article className="chat-card dm-card thinking"><div className="message-label">✦ DUNGEON MASTER</div><p>Consulting the fates…</p></article>}</div>
          <form onSubmit={send} className="chat-composer"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What does your character do?" /><button disabled={loading} className="rpg-button">{loading ? "Rolling…" : "Speak"} <span>➤</span></button></form>
        </> : <div className="empty-table no-campaign"><span>⚄</span><h2>Raise a new banner</h2><p>Open the Campaigns panel and create a table for your next adventure.</p></div>}
      </section>
      {partyOpen && <RpgPartyPanel selected={selected} token={token} refresh={() => selected && openCampaign(selected.campaign._id)} onError={setError} close={() => setPartyOpen(false)} />}
    </div>
    {error && <p className="rpg-error">{error}</p>}
  </main>;
}

function RpgPartyPanel({ selected, token, refresh, onError, close }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const add = async (event) => {
    event.preventDefault();
    if (!selected) return;
    try { await request(`/campaigns/${selected.campaign._id}/characters`, { method: "POST", body: JSON.stringify({ name, race: "Unknown", className: "Adventurer" }) }, token); setName(""); refresh(); } catch (err) { onError(err.message); }
  };
  const upload = async (character) => {
    if (!file) return;
    setUploading(true);
    try { const body = new FormData(); body.append("sheet", file); await request(`/characters/${character._id}/sheet`, { method: "POST", body }, token); setFile(null); refresh(); } catch (err) { onError(err.message.includes("Failed to fetch") ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ หรือ AI ใช้เวลานานเกินไป กรุณาลองใหม่" : err.message); } finally { setUploading(false); }
  };
  return <aside className="rpg-sidebar party-panel"><div className="panel-heading"><span>♜ CHARACTER SHEETS</span><button onClick={close} aria-label="Collapse character sheets">›</button></div>{selected ? <><form onSubmit={add} className="party-add"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Character name" /><button>+</button></form><label className="sheet-picker">⌑ <span>{file ? file.name : "Choose a character sheet"}</span><input onChange={(event) => setFile(event.target.files?.[0])} type="file" accept=".pdf,.txt,.json" /></label><div className="character-list">{selected.characters.map((character) => <article key={character._id} className="character-card"><div className="portrait">{character.name?.slice(0, 1) || "?"}</div><div><b>{character.name}</b><p>Level {character.level} · {character.race} {character.className}</p>{character.sheet?.summary ? <small>✦ Sheet read: {character.sheet.fileName}</small> : <button disabled={!file || uploading} onClick={() => upload(character)}>{uploading ? "Reading sheet…" : "Read selected sheet"}</button>}</div></article>)}</div></> : <p className="panel-empty">Choose a campaign to gather the party.</p>}</aside>;
}

function ChatRpgDashboard({ session, campaigns, setCampaigns, selected, setSelected, error, setError, loadCampaigns, openCampaign, logout }) {
  const token = session.token;
  const [newCampaign, setNewCampaign] = useState("");
  const [premise, setPremise] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [sheetsOpen, setSheetsOpen] = useState(true);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const sheetFileInput = useRef(null);
  const createCampaign = async (event) => { event.preventDefault(); try { const { campaign } = await request("/campaigns", { method: "POST", body: JSON.stringify({ name: newCampaign, description: premise.trim() || "ผู้เล่นไม่ได้ระบุธีม ให้เลือกธีมที่น่าสนใจเอง" }) }, token); setNewCampaign(""); setPremise(""); await loadCampaigns(); openCampaign(campaign._id); } catch (err) { setError(err.message); } };
  const send = async (event) => {
    event.preventDefault();
    if (!message.trim() || !selected || loading) return;
    const outgoingMessage = message.trim();
    const optimisticId = `optimistic-${Date.now()}`;
    setSelected((current) => current && {
      ...current,
      messages: [...current.messages, { _id: optimisticId, role: "player", content: outgoingMessage }],
    });
    setMessage("");
    setLoading(true);
    try {
      const data = await request(`/campaigns/${selected.campaign._id}/dm`, { method: "POST", body: JSON.stringify({ message: outgoingMessage }) }, token);
      const dmMessage = data.messages.find((item) => item.role === "dm");
      setSelected((current) => current && {
        ...current,
        messages: [...current.messages.filter((item) => item._id !== optimisticId), data.messages.find((item) => item.role === "player") || { _id: optimisticId, role: "player", content: outgoingMessage }, ...(dmMessage ? [dmMessage] : [])],
      });
    } catch (err) {
      setSelected((current) => current && { ...current, messages: current.messages.filter((item) => item._id !== optimisticId) });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const removeCampaign = async () => { if (!selected || !window.confirm(`Delete campaign "${selected.campaign.name}"? This cannot be undone.`)) return; try { await request(`/campaigns/${selected.campaign._id}`, { method: "DELETE" }, token); const remaining = campaigns.filter((item) => item._id !== selected.campaign._id); setCampaigns(remaining); setSelected(null); if (remaining[0]) openCampaign(remaining[0]._id); } catch (err) { setError(err.message); } };
  const addCharacter = async (event) => { event.preventDefault(); if (!selected) return; try { await request(`/campaigns/${selected.campaign._id}/characters`, { method: "POST", body: JSON.stringify({ name, race: "Unknown", className: "Adventurer" }) }, token); setName(""); openCampaign(selected.campaign._id); } catch (err) { setError(err.message); } };
  const upload = async (character) => { if (!file) { sheetFileInput.current?.click(); return; } setUploading(true); try { const body = new FormData(); body.append("sheet", file); await request(`/characters/${character._id}/sheet`, { method: "POST", body }, token); setFile(null); openCampaign(selected.campaign._id); } catch (err) { setError(err.message); } finally { setUploading(false); } };
  return <main className={`chat-rpg ${sidebarOpen ? "sidebar-on" : ""}`}>
    {sidebarOpen && <aside className="chat-sidebar">
      <div className="chat-side-top"><b>⚄ PortAbleTrack</b><button onClick={() => setSidebarOpen(false)} title="Hide sidebar">◧</button></div>
      <button className="new-table" onClick={() => { setCampaignsOpen(true); document.querySelector(".campaign-form")?.querySelector("input")?.focus(); }}>＋ New campaign</button>
      <section className="side-section"><button className="side-section-title" onClick={() => setCampaignsOpen((open) => !open)}>⌄ <span>CAMPAIGNS</span></button>{campaignsOpen && <><form onSubmit={createCampaign} className="chat-campaign-form"><input required value={newCampaign} onChange={(event) => setNewCampaign(event.target.value)} placeholder="Campaign name" /><textarea value={premise} onChange={(event) => setPremise(event.target.value)} placeholder="Premise (optional)" maxLength={5000} rows="2" /><button>Create campaign</button></form><div className="chat-campaign-list">{campaigns.map((campaign) => <button key={campaign._id} onClick={() => openCampaign(campaign._id)} className={selected?.campaign._id === campaign._id ? "active" : ""}><b>{campaign.name}</b><small>{campaign.settings.system}</small></button>)}</div></>}</section>
      <div className="section-divider" aria-hidden="true" />
      <section className="side-section sheets-section"><button className="side-section-title" onClick={() => setSheetsOpen((open) => !open)}>⌄ <span>CHARACTER SHEETS</span></button>{sheetsOpen && (selected ? <><form onSubmit={addCharacter} className="chat-character-add"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Character name" /><button>+</button></form><label className="chat-file-picker">⌑ {file ? file.name : "Upload character sheet"}<input ref={sheetFileInput} type="file" accept=".pdf,.txt,.json" onChange={(event) => setFile(event.target.files?.[0])} /></label><div className="chat-character-list">{selected.characters.map((character) => <div key={character._id}><b>{character.name}</b><small>Lv. {character.level} · {character.className}</small>{character.sheet?.summary ? <em>Sheet read</em> : <button type="button" disabled={uploading} onClick={() => upload(character)}>{uploading ? "Reading…" : file ? "Read sheet" : "Choose & read sheet"}</button>}</div>)}</div></> : <p className="sidebar-hint">Select a campaign to see its party.</p>)}</section>
      <div className="chat-user"><span>{session.user.name}</span><button onClick={logout}>Leave realm</button></div>
    </aside>}
    <section className="chat-main">
      <header className="chat-main-header">{!sidebarOpen && <button onClick={() => setSidebarOpen(true)}>☰</button>}<div>{selected ? <><b>{selected.campaign.name}</b><small>{selected.campaign.settings.system} · AI Dungeon Master</small></> : <b>PortAbleTrack</b>}</div>{selected && <button className="delete-chat" onClick={removeCampaign}>Delete</button>}</header>
      {selected ? <><div className="chat-history">{selected.messages.length === 0 && <div className="chat-welcome"><span>⚄</span><h1 className="empty-state-headline">The table is ready.</h1><p>Describe the opening scene or ask your Dungeon Master to begin.</p></div>}{selected.messages.map((item) => <article key={item._id} className={item.role === "dm" ? "chat-dm-message" : "chat-user-message"}><span>{item.role === "dm" ? "✦ Dungeon Master" : "You"}</span><p>{item.content}</p></article>)}{loading && <article className="chat-dm-message"><span>✦ Dungeon Master</span><p>Consulting the fates…</p></article>}</div><form onSubmit={send} className="chat-input"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message the Dungeon Master…" /><button disabled={loading}>➤</button></form></> : <div className="chat-welcome"><span className="dice-mark">✦</span><h1 className="empty-state-headline">BEGIN A NEW LEGEND.</h1><p>Open the sidebar and create a campaign to summon your Dungeon Master.</p></div>}
    </section>{error && <p className="rpg-error">{error}</p>}
  </main>;
}

export default App;
