'use client';

import { useCallback, useEffect, useState } from 'react';
import { admin, adminKey, Tenant, TenantWithKey } from '@/lib/api';

export default function AdminPage() {
  const [key, setKey] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<TenantWithKey | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTenants(await admin.listTenants());
      setError(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = adminKey.get();
    if (stored) {
      setKey(stored);
      void load().then((ok) => setUnlocked(ok));
    }
  }, [load]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    adminKey.set(key.trim());
    setUnlocked(await load());
  }

  function lock() {
    adminKey.clear();
    setUnlocked(false);
    setKey('');
    setTenants([]);
    setIssued(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const f = new FormData(e.target as HTMLFormElement);
    const value = (k: string) => String(f.get(k) ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      const created = await admin.createTenant({
        name: value('name'),
        slug: value('slug'),
        ...(value('apiKey') ? { apiKey: value('apiKey') } : {}),
        ...(value('login') ? { dataforseoLogin: value('login') } : {}),
        ...(value('password') ? { dataforseoPassword: value('password') } : {}),
        monthlyCapUsd: Number(value('cap') || 0),
        perJobCapUsd: Number(value('perJob') || 0),
        serpDepth: Number(value('depth') || 20),
      });
      setIssued(created);
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rotate(t: Tenant) {
    setBusy(true);
    try {
      setIssued(await admin.rotateKey(t.id));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(t: Tenant, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await admin.updateTenant(t.id, body);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked) {
    return (
      <section className="panel" style={{ maxWidth: 520 }}>
        <h2>Admin</h2>
        {error && <div className="notice err">{error}</div>}
        <form onSubmit={unlock}>
          <div className="field">
            <label htmlFor="adminkey">Admin key</label>
            <input id="adminkey" type="password" value={key} autoComplete="off"
                   onChange={(e) => setKey(e.target.value)}
                   placeholder="the ADMIN_API_KEY from the API's .env" />
          </div>
          <button className="primary" type="submit">Unlock</button>
        </form>
        <p className="small muted" style={{ marginTop: 14 }}>
          Held in this tab only, never written into the page bundle. Anyone with this
          key can read and change every tenant, so don&apos;t expose this page publicly.
        </p>
      </section>
    );
  }

  return (
    <>
      {issued && (
        <section className="panel" style={{ borderColor: 'var(--ok)' }}>
          <h2>New key for {issued.slug}</h2>
          <p className="small">
            Shown once. It is stored only as a hash, so it cannot be looked up later &mdash;
            rotate again if it is lost.
          </p>
          <pre className="keybox">{issued.apiKey}</pre>
          <p className="small muted">Paste into that client&apos;s <code>.env.local</code>:</p>
          <pre className="keybox">NEXT_PUBLIC_API_KEY={issued.apiKey}</pre>
          <button className="small" onClick={() => setIssued(null)}>Done, hide it</button>
        </section>
      )}

      <section className="panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>Add a client</h2>
          <button className="small" onClick={lock}>Lock</button>
        </div>
        {error && <div className="notice err" style={{ marginTop: 12 }}>{error}</div>}
        <form onSubmit={create} style={{ marginTop: 14 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="name">Client name</label>
              <input id="name" name="name" type="text" required placeholder="ABC Ltd" />
            </div>
            <div className="field">
              <label htmlFor="slug">Domain (identifier)</label>
              <input id="slug" name="slug" type="text" required placeholder="abc.com" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="apiKey">
              API key for this client&apos;s frontend &mdash; leave blank to generate one
            </label>
            <input id="apiKey" name="apiKey" type="text" autoComplete="off"
                   placeholder="generated automatically if empty (min 24 characters)" />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="login">DataForSEO login</label>
              <input id="login" name="login" type="text" placeholder="abc@example.com" />
            </div>
            <div className="field">
              <label htmlFor="password">DataForSEO API password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="cap">Monthly cap (USD, 0 = unlimited)</label>
              <input id="cap" name="cap" type="text" defaultValue="25" />
            </div>
            <div className="field">
              <label htmlFor="perJob">Per-job cap (USD)</label>
              <input id="perJob" name="perJob" type="text" defaultValue="0" />
            </div>
            <div className="field">
              <label htmlFor="depth">SERP depth</label>
              <input id="depth" name="depth" type="text" defaultValue="20" />
            </div>
          </div>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Working...' : 'Create client'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Clients</h2>
        {!tenants.length && <p className="muted small">None yet.</p>}
        <table>
          <thead>
            <tr>
              <th>Client</th><th>Key</th><th>DataForSEO</th>
              <th>Caps</th><th>Spend (month)</th><th />
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.slug}</strong>
                  <div className="small muted">{t.name}</div>
                  {!t.active && <span className="tag failed">disabled</span>}
                </td>
                <td className="mono">...{t.apiKeyHint}</td>
                <td className="small">
                  {t.hasCredentials
                    ? t.dataforseoLogin
                    : <span className="tag low">not configured</span>}
                </td>
                <td className="small">
                  ${t.monthlyCapUsd.toFixed(2)}/mo<br />
                  ${t.perJobCapUsd.toFixed(2)}/job<br />
                  depth {t.serpDepth}
                </td>
                <td className="small">${(t.spendThisMonth ?? 0).toFixed(4)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="small" disabled={busy} onClick={() => rotate(t)}>
                      New key
                    </button>
                    <button className="small" disabled={busy}
                            onClick={() => patch(t, { active: !t.active })}>
                      {t.active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
