'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Deliverability, DomainResult, Job, Page, StatusCounts, StatusFilter } from '@/lib/api';
import { ResultsTable } from './results-table';

const ACTIVE = new Set(['queued', 'running']);
const PAGE_SIZE = 100;

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [job, setJob] = useState<Job | null>(null);
  const [page, setPage] = useState<Page<DomainResult> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>('');
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [mail, setMail] = useState<Deliverability | null>(null);
  const [mailStatus, setMailStatus] = useState('');
  const [confidence, setConfidence] = useState('');
  const [search, setSearch] = useState('');
  const [pageNo, setPageNo] = useState(1);

  const loadJob = useCallback(() => {
    api.getJob(id).then(setJob).catch((e: Error) => setError(e.message));
    api.statusCounts(id).then(setCounts).catch(() => setCounts(null));
    api.deliverability(id).then(setMail).catch(() => setMail(null));
  }, [id]);

  const loadResults = useCallback(() => {
    api
      .results(id, {
        status, confidence, search, mailStatus,
        page: String(pageNo), pageSize: String(PAGE_SIZE),
      })
      .then(setPage)
      .catch((e: Error) => setError(e.message));
  }, [id, status, confidence, search, mailStatus, pageNo]);

  useEffect(() => { loadJob(); }, [loadJob]);
  useEffect(() => { loadResults(); }, [loadResults]);

  // Poll only while the run is moving.
  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return;
    const t = setInterval(() => { loadJob(); loadResults(); }, 2500);
    return () => clearInterval(t);
  }, [job, loadJob, loadResults]);

  const [downloading, setDownloading] = useState<string | null>(null);

  /**
   * Exports go through fetch, not a link, so the API key travels in a header
   * rather than the URL. A plain <a href> would navigate without it and the
   * API would answer 401.
   */
  async function download(
    format: 'csv' | 'json',
    opts: { status?: StatusFilter; mailStatus?: string; detail?: 'full' },
    label?: string,
  ) {
    setDownloading(label ?? format);
    setError(null);
    try {
      await api.download(id, format, opts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  async function act(verb: 'resume' | 'retry-errors' | 'cancel' | 'pause') {
    setError(null);
    try {
      await api.action(id, verb);
      loadJob();
      loadResults();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!job) {
    return <p className="muted">{error ?? 'Loading...'}</p>;
  }

  const pct = job.totalDomains ? Math.round((job.processed / job.totalDomains) * 100) : 0;
  const running = ACTIVE.has(job.status);

  return (
    <>
      <section className="panel">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span className={`tag ${job.status}`}>{job.status}</span>
          <strong>{job.name}</strong>
          <span style={{ flex: 1 }} />
          <Link href="/" className="small">All runs</Link>
        </div>

        {error && <div className="notice err">{error}</div>}
        {job.error && <div className="notice err">{job.error}</div>}
        {job.status === 'paused' && !job.error && (
          <div className="notice ok">
            Paused. The remaining domains are still queued &mdash; press Resume to continue.
          </div>
        )}
        {job.status === 'interrupted' && (
          <div className="notice err">
            The dyno restarted mid-run. Nothing was lost &mdash; press Resume to carry on from where it stopped.
          </div>
        )}

        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <p className="small muted">{job.processed} of {job.totalDomains} processed ({pct}%)</p>

        <div className="stats" style={{ marginTop: 16 }}>
          <button type="button"
                  className={`stat clickable${status === 'resolved' ? ' on' : ''}`}
                  onClick={() => { setStatus('resolved'); setPageNo(1); }}>
            <div className="n">{counts?.resolved ?? job.resolved}</div>
            <div className="k">Resolved</div>
          </button>
          <button type="button"
                  className={`stat clickable${status === 'unresolved' ? ' on' : ''}`}
                  onClick={() => { setStatus('unresolved'); setPageNo(1); }}>
            <div className="n">{counts?.unresolved ?? job.totalDomains - job.resolved}</div>
            <div className="k">Unresolved</div>
          </button>
          <div className="stat"><div className="n">{job.errored}</div><div className="k">Errors</div></div>
          <button type="button"
                  className={`stat clickable${mailStatus === 'undeliverable' ? ' on' : ''}`}
                  onClick={() => { setMailStatus('undeliverable'); setPageNo(1); }}>
            <div className="n">{mail?.undeliverable ?? 0}</div>
            <div className="k">Dead domains</div>
          </button>
          <div className="stat"><div className="n">{job.cacheHits}</div><div className="k">From cache</div></div>
          <div className="stat"><div className="n">${Number(job.costUsd).toFixed(2)}</div><div className="k">API cost</div></div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {running ? (
            <>
              <button className="small" onClick={() => act('pause')}>Pause</button>
              <button className="small" onClick={() => act('cancel')}>Cancel</button>
            </>
          ) : (
            <button className="small" onClick={() => act('resume')}>Resume</button>
          )}
          <button className="small" onClick={() => act('retry-errors')} disabled={!job.errored}>
            Retry {job.errored} error{job.errored === 1 ? '' : 's'}
          </button>
          <span style={{ flex: 1 }} />
          <button className="small" disabled={downloading !== null}
                  onClick={() => download('json', { status, mailStatus })}>
            {downloading === 'json'
              ? 'Preparing...'
              : `Export JSON${status ? ` (${status})` : ' (resolved, deliverable)'}`}
          </button>
          <button className="small" disabled={downloading !== null}
                  onClick={() => download('csv', { status, mailStatus })}>
            {downloading === 'csv' ? 'Preparing...' : `Export CSV${status ? ` (${status})` : ''}`}
          </button>
          <button className="small muted" disabled={downloading !== null}
                  onClick={() => download('json', { status, detail: 'full' }, 'full')}>
            {downloading === 'full' ? 'Preparing...' : 'Full detail JSON'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Results</h2>

        <div className="toolbar">
          <div>
            <label htmlFor="f-status">Status</label>
            <select id="f-status" value={status}
                    onChange={(e) => { setStatus(e.target.value as StatusFilter); setPageNo(1); }}>
              <option value="">All ({job.totalDomains})</option>
              <option value="resolved">Resolved{counts ? ` (${counts.resolved})` : ''}</option>
              <option value="unresolved">Unresolved{counts ? ` (${counts.unresolved})` : ''}</option>
              <option value="not_found">&nbsp;&nbsp;— Not found{counts ? ` (${counts.not_found})` : ''}</option>
              <option value="error">&nbsp;&nbsp;— Error{counts ? ` (${counts.error})` : ''}</option>
              <option value="pending">&nbsp;&nbsp;— Pending{counts ? ` (${counts.pending})` : ''}</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-conf">Confidence</label>
            <select id="f-conf" value={confidence}
                    onChange={(e) => { setConfidence(e.target.value); setPageNo(1); }}>
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low &mdash; check these</option>
              <option value="manual">Manually set</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-mail">Deliverability</label>
            <select id="f-mail" value={mailStatus}
                    onChange={(e) => { setMailStatus(e.target.value); setPageNo(1); }}>
              <option value="">All</option>
              <option value="deliverable">
                Domain accepts mail{mail ? ` (${mail.deliverable})` : ''}
              </option>
              <option value="undeliverable">
                Dead domain{mail ? ` (${mail.undeliverable})` : ''}
              </option>
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label htmlFor="f-search">Search domain or name</label>
            <input id="f-search" type="text" value={search}
                   onChange={(e) => { setSearch(e.target.value); setPageNo(1); }} />
          </div>
          {(status || confidence || search || mailStatus) && (
            <div style={{ flex: '0 0 auto' }}>
              <button className="small" onClick={() => {
                setStatus(''); setConfidence(''); setSearch(''); setMailStatus(''); setPageNo(1);
              }}>Clear filters</button>
            </div>
          )}
        </div>

        {page && (
          <>
            <ResultsTable
              jobId={id}
              rows={page.items}
              onChanged={() => { loadJob(); loadResults(); }}
            />
            <div className="pager">
              <span className="small muted">
                {page.total ? (page.page - 1) * page.pageSize + 1 : 0}
                &ndash;{Math.min(page.page * page.pageSize, page.total)} of {page.total}
              </span>
              <button className="small" disabled={pageNo <= 1} onClick={() => setPageNo((p) => p - 1)}>
                Previous
              </button>
              <button className="small" disabled={pageNo * PAGE_SIZE >= page.total}
                      onClick={() => setPageNo((p) => p + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
