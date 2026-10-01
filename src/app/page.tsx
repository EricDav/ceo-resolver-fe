'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Job } from '@/lib/api';

const ACTIVE = new Set(['queued', 'running']);

export default function HomePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [skip, setSkip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api.listJobs().then(setJobs).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const file = fileRef.current?.files?.[0];
      const job = file
        ? await api.uploadJob(file, name, skip)
        : await api.createJob({ name, text, skipAlreadyResolved: skip });
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>New run</h2>
        {error && <div className="notice err">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Run name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="September prospect list" />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="text">Paste emails, domains or URLs (one per line)</label>
              <textarea id="text" value={text} onChange={(e) => setText(e.target.value)}
                        placeholder={'jane@acme.com\nhttps://beta.co.uk/about\ngamma.org'} />
            </div>
            <div className="field">
              <label htmlFor="file">...or upload a file</label>
              <input id="file" type="file" ref={fileRef} accept=".txt,.csv,.json" />
              <p className="small muted" style={{ marginTop: 10 }}>
                Emails are reduced to their domain and de-duplicated. A file wins over pasted text.
              </p>
            </div>
          </div>

          <div className="field">
            <label className="checkbox">
              <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
              Skip domains already resolved in an earlier run
            </label>
          </div>

          <button className="primary" type="submit" disabled={busy}>
            {busy ? 'Starting...' : 'Start run'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Runs</h2>
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            const q = quick.trim();
            router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
          }}
        >
          <div style={{ flex: '1 1 240px' }}>
            <label htmlFor="quick">Find a domain across every run</label>
            <input id="quick" type="text" value={quick} placeholder="acme.com"
                   onChange={(e) => setQuick(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
            <button className="small" type="submit">Search</button>
          </div>
        </form>

        {!jobs.length && <p className="muted small">No runs yet.</p>}
        <div className="joblist">
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="jobcard">
              <span className={`tag ${j.status}`}>{j.status}</span>
              <span className="name">{j.name}</span>
              <span className="spacer" style={{ flex: 1 }} />
              <span className="small muted">
                {j.resolved}/{j.totalDomains} resolved
                {ACTIVE.has(j.status) && ` · ${j.processed} processed`}
                {' · '}${Number(j.costUsd).toFixed(2)}
              </span>
              <span className="small muted">{new Date(j.createdAt).toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
