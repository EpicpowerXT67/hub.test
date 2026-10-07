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
  if (!response.ok) {
    const error = new Error(data.message || "The spell failed.");
    error.status = response.status;
    throw error;
  }
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
        <p className="font-display text-lg z-10">⚄ Adventure Journey</p>
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

  const clearSession = () => {
    localStorage.removeItem("portabletrack_session");
    setSession(null);
    setCampaigns([]);
    setSelected(null);
    setError("");
  };

  const loadCampaigns = async () => {
    try {
      const data = await request("/campaigns", {}, token);
      setCampaigns(data.campaigns);
      if (!selected && data.campaigns[0]) openCampaign(data.campaigns[0]._id);
    } catch (err) {
      if (err.status === 401 || /invalid|expired|token/i.test(err.message)) {
        clearSession();
        return;
      }
      setError(err.message);
    }
  };
  const openCampaign = async (id) => {
    const requestId = ++campaignRequest.current;
    try {
      const campaign = await request(`/campaigns/${id}`, {}, token);
      if (requestId === campaignRequest.current) setSelected(campaign);
    } catch (err) {
      if (err.status === 401 || /invalid|expired|token/i.test(err.message)) {
        clearSession();
        return;
      }
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
      logout={clearSession}
    />
  );
}
function ChatRpgDashboard({ session, campaigns, setCampaigns, selected, setSelected, error, setError, loadCampaigns, openCampaign, logout }) {
  const token = session.token;
  const [newCampaign, setNewCampaign] = useState("");
  const [premise, setPremise] = useState("");
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [campaignsOpen, setCampaignsOpen] = useState(true);
  const [sheetsOpen, setSheetsOpen] = useState(true);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const sheetFileInput = useRef(null);
  const campaignNameInputRef = useRef(null);

  const focusNewCampaignInput = () => {
    setCampaignsOpen(true);
    setShowNewCampaignForm(true);
    window.requestAnimationFrame(() => campaignNameInputRef.current?.focus());
  };

  const toggleNewCampaignForm = () => {
    setShowNewCampaignForm((open) => {
      const next = !open;
      if (next) {
        setCampaignsOpen(true);
        window.requestAnimationFrame(() => campaignNameInputRef.current?.focus());
      }
      return next;
    });
  };

  const createCampaign = async (event) => { event.preventDefault(); try { const { campaign } = await request("/campaigns", { method: "POST", body: JSON.stringify({ name: newCampaign, description: premise.trim() || "ผู้เล่นไม่ได้ระบุธีม ให้เลือกธีมที่น่าสนใจเอง" }) }, token); setNewCampaign(""); setPremise(""); setShowNewCampaignForm(false); await loadCampaigns(); openCampaign(campaign._id); } catch (err) { setError(err.message); } };
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
      setMessage(outgoingMessage);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const removeCampaign = async () => { if (!selected || !window.confirm(`Delete campaign "${selected.campaign.name}"? This cannot be undone.`)) return; try { await request(`/campaigns/${selected.campaign._id}`, { method: "DELETE" }, token); const remaining = campaigns.filter((item) => item._id !== selected.campaign._id); setCampaigns(remaining); setSelected(null); if (remaining[0]) openCampaign(remaining[0]._id); } catch (err) { setError(err.message); } };
  const addCharacter = async (event) => { event.preventDefault(); if (!selected) return; try { await request(`/campaigns/${selected.campaign._id}/characters`, { method: "POST", body: JSON.stringify({ name, race: "Unknown", className: "Adventurer" }) }, token); setName(""); openCampaign(selected.campaign._id); } catch (err) { setError(err.message); } };
  const upload = async (character) => { if (!file) { sheetFileInput.current?.click(); return; } setUploading(true); try { const body = new FormData(); body.append("sheet", file); await request(`/characters/${character._id}/sheet`, { method: "POST", body }, token); setFile(null); openCampaign(selected.campaign._id); } catch (err) { setError(err.message); } finally { setUploading(false); } };
  return <main className={`chat-rpg ${sidebarOpen ? "sidebar-on" : ""}`}>
    <aside className={`chat-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
      <div className="chat-sidebar-inner">
        <div className="chat-side-top"><b>⚄ Adventure Journey</b><button onClick={() => setSidebarOpen(false)} title="Hide sidebar">◧</button></div>
        <button className="new-table" onClick={toggleNewCampaignForm}>＋ New campaign</button>
        <section className="side-section" id="campaign-list-section">{campaigns.length > 0 && <button
          className="side-section-title campaigns-toggle"
          type="button"
          aria-expanded={campaignsOpen}
          aria-controls="campaign-list-section"
          onClick={() => setCampaignsOpen((open) => !open)}
        >
          <svg className={`campaign-chevron ${campaignsOpen ? "open" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>CAMPAIGNS</span>
        </button>}{campaignsOpen && <>
          {showNewCampaignForm && (
            <div className="new-campaign-form">
              <form onSubmit={createCampaign} className="chat-campaign-form">
                <input ref={campaignNameInputRef} required value={newCampaign} onChange={(event) => setNewCampaign(event.target.value)} placeholder="Campaign name" />
                <textarea value={premise} onChange={(event) => setPremise(event.target.value)} placeholder="Premise (optional)" maxLength={5000} rows="2" />
                <button type="submit">Create campaign</button>
              </form>
            </div>
          )}
          <div className="chat-campaign-list">{campaigns.map((campaign) => <button key={campaign._id} onClick={() => openCampaign(campaign._id)} className={selected?.campaign._id === campaign._id ? "active" : ""}><b>{campaign.name}</b><small>{campaign.settings.system}</small></button>)}</div>
        </>}</section>
        <div className="section-divider" aria-hidden="true" />
        <section className="side-section sheets-section"><button
          className="side-section-title sheets-toggle"
          type="button"
          aria-expanded={sheetsOpen}
          onClick={() => setSheetsOpen((open) => !open)}
        >
          <svg className={`campaign-chevron ${sheetsOpen ? "open" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>CHARACTER SHEETS</span>
        </button>{sheetsOpen && (selected ? <><form onSubmit={addCharacter} className="chat-character-add"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Character name" /><button>+</button></form><label className="chat-file-picker">⌑ {file ? file.name : "Upload character sheet"}<input ref={sheetFileInput} type="file" accept=".pdf,.txt,.json" onChange={(event) => setFile(event.target.files?.[0])} /></label><div className="chat-character-list">{selected.characters.map((character) => <div key={character._id}><b>{character.name}</b><small>Lv. {character.level} · {character.className}</small>{character.sheet?.summary ? <em>Sheet read</em> : <button type="button" disabled={uploading} onClick={() => upload(character)}>{uploading ? "Reading…" : file ? "Read sheet" : "Choose & read sheet"}</button>}</div>)}</div></> : <p className="sidebar-hint">Select a campaign to see its party.</p>)}</section>
        <div className="chat-user"><span>{session.user.name}</span><button onClick={logout}>Leave realm</button></div>
      </div>
    </aside>
    <section className="chat-main">
      <header className="chat-main-header">{!sidebarOpen && <button onClick={() => setSidebarOpen(true)}>☰</button>}<div>{selected ? <><b>{selected.campaign.name}</b><small>{selected.campaign.settings.system} · AI Dungeon Master</small></> : <b>Adventure Journey</b>}</div>{selected && <button className="delete-chat" onClick={removeCampaign}>Delete</button>}</header>
      {selected ? <><div className="chat-history">{selected.messages.length === 0 && <div className="chat-welcome"><span>⚄</span><h1 className="empty-state-headline">The table is ready.</h1><p>Describe the opening scene or ask your Dungeon Master to begin.</p></div>}{selected.messages.map((item) => <article key={item._id} className={item.role === "dm" ? "chat-dm-message" : "chat-user-message"}><span>{item.role === "dm" ? "✦ Dungeon Master" : "You"}</span><p>{item.content}</p></article>)}{loading && <article className="chat-dm-message"><span>✦ Dungeon Master</span><p>Consulting the fates…</p></article>}</div><form onSubmit={send} className="chat-input"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message the Dungeon Master…" /><button disabled={loading}>➤</button></form></> : <div className="chat-welcome"><span className="dice-mark">✦</span><h1 className="empty-state-headline">BEGIN A NEW LEGEND.</h1><p>Open the sidebar and create a campaign to summon your Dungeon Master.</p></div>}
    </section>{error && <p className="rpg-error">{error}</p>}
  </main>;
}

export default App;
