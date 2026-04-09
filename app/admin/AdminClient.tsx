'use client';

import { useState, useEffect, useRef } from 'react';

interface Festival {
  slug: string;
  name: string;
  accent: string;
  setCount: number;
  hidden: boolean;
}

interface SearchResult {
  tlId: string;
  dj: string;
  stage: string;
  date: string;
  year: number;
  festival: string;
  festivalName: string;
  duration: string;
}

export function AdminClient() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  // Data
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [blockedSets, setBlockedSets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const storedPassword = useRef('');

  async function login() {
    setAuthError('');
    try {
      const res = await fetch('/api/admin/blocklist', {
        headers: { 'x-admin-password': password },
      });
      if (res.status === 401) {
        setAuthError('Wrong password');
        return;
      }
      const data = await res.json();
      storedPassword.current = password;
      setBlockedSets(data.sets || []);
      setAuthed(true);

      // Load festival data from a separate endpoint
      loadFestivals();
    } catch {
      setAuthError('Failed to connect');
    }
  }

  async function loadFestivals() {
    try {
      const res = await fetch('/api/admin/festivals', {
        headers: { 'x-admin-password': storedPassword.current },
      });
      if (res.ok) {
        const data = await res.json();
        setFestivals(data.festivals || []);
      }
    } catch {}
  }

  async function callApi(body: Record<string, string>) {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/blocklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': storedPassword.current,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage('Saved. Restart dev server or redeploy to apply.');
        setBlockedSets(data.sets || []);
        return data;
      } else {
        setMessage('Error: ' + (data.error || 'unknown'));
      }
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFestival(slug: string, currentlyHidden: boolean) {
    const result = await callApi({
      action: currentlyHidden ? 'show_festival' : 'hide_festival',
      slug,
    });
    if (result?.ok) {
      setFestivals(prev => prev.map(f =>
        f.slug === slug ? { ...f, hidden: !currentlyHidden } : f
      ));
    }
  }

  async function blockSet(tlId: string) {
    await callApi({ action: 'block_set', tlId });
  }

  async function unblockSet(tlId: string) {
    await callApi({ action: 'unblock_set', tlId });
  }

  // Debounced search
  useEffect(() => {
    if (!authed) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/search-sets?q=${encodeURIComponent(searchQuery.trim())}`, {
          headers: { 'x-admin-password': storedPassword.current },
        });
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch {}
      setSearching(false);
    }, 300);
  }, [searchQuery, authed]);

  // Login screen
  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 24 }}>Admin</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Password..."
            autoFocus
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={login}
            style={{
              padding: '10px 20px',
              background: 'var(--purple)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Login
          </button>
        </div>
        {authError && (
          <div style={{ color: 'var(--red, #ef4444)', fontSize: '0.8125rem', marginTop: 12 }}>{authError}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: 8 }}>Admin</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: 32 }}>
        Manage festivals and sets. Changes write to <code>data/blocklist.json</code>.
        Restart dev server or redeploy to apply.
      </p>

      {message && (
        <div style={{
          padding: '10px 16px',
          background: 'var(--purple-dim)',
          border: '1px solid var(--purple)',
          borderRadius: 8,
          fontSize: '0.8125rem',
          color: 'var(--purple-lt)',
          marginBottom: 24,
        }}>
          {message}
        </div>
      )}

      {/* Festivals */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Festivals</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {festivals.map(f => (
            <div
              key={f.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: f.hidden ? 'var(--surface)' : 'var(--surface2)',
                borderRadius: 8,
                opacity: f.hidden ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.accent, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {f.slug} &middot; {f.setCount.toLocaleString()} sets
                  </div>
                </div>
              </div>
              <button
                onClick={() => toggleFestival(f.slug, f.hidden)}
                disabled={saving}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: f.hidden ? 'rgba(34,197,94,0.15)' : 'var(--surface)',
                  color: f.hidden ? '#22c55e' : 'var(--muted-lt)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {f.hidden ? 'Show' : 'Hide'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Block Sets */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Block Sets</div>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by DJ name, stage, or tlId..."
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />

        {searching && (
          <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', padding: '8px 0' }}>Searching...</div>
        )}

        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            {searchResults.map(s => {
              const isBlocked = blockedSets.includes(s.tlId);
              return (
                <div
                  key={s.tlId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: isBlocked ? 'rgba(239,68,68,0.1)' : 'var(--surface)',
                    borderRadius: 8,
                    fontSize: '0.8125rem',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{s.dj}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {s.festivalName} &middot; {s.stage} &middot; {s.date} &middot; {s.duration || 'no duration'}
                      <span style={{ fontFamily: 'monospace', marginLeft: 6, opacity: 0.6 }}>{s.tlId}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => isBlocked ? unblockSet(s.tlId) : blockSet(s.tlId)}
                    disabled={saving}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: isBlocked ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: isBlocked ? '#22c55e' : '#ef4444',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: '0.8125rem', padding: '8px 0' }}>No sets found.</div>
        )}
      </div>

      {/* Currently Blocked */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Currently Blocked</div>
          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{blockedSets.length} sets</div>
        </div>
        {blockedSets.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>No blocked sets.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {blockedSets.map(tlId => (
              <div
                key={tlId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: 'var(--surface)',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: 'var(--muted-lt)',
                }}
              >
                {tlId}
                <button
                  onClick={() => unblockSet(tlId)}
                  disabled={saving}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  title="Unblock"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
