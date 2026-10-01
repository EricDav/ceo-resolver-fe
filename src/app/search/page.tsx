'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, Page, SearchHit, StatusFilter } from '@/lib/api';
import { useDebounced } from '@/lib/use-debounced';
import { ResultsTable } from '@/components/results-table';

const PAGE_SIZE = 50;

function SearchView() {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState<StatusFilter>('');
  const [confidence, setConfidence] = useState('');
  const [pageNo, setPageNo] = useState(1);

  const [page, setPage] = useState<Page<SearchHit> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const term = useDebounced(q.trim(), 300);

  // Keep the URL in step, so a search can be bookmarked or shared.
  useEffect(() => {
    const next = term ? `/search?q=${encodeURIComponent(term)}` : '/search';
    router.replace(next, { scroll: false });
  }, [term, router]);

  useEffect(() => { setPageNo(1); }, [term, status, confidence]);

  const load = useCallback(() => {
    if (term.length < 2) {
      setPage(null);
      setError(null);
      return;
    }
    setLoading(true);
    api
      .searchAll(term, {
        status,
        confidence,
        page: String(pageNo),
        pageSize: String(PAGE_SIZE),
      })
      .then((p) => { setPage(p); setError(null); })
      .catch((e: Error) => { setError(e.message); setPage(null); })
      .finally(() => setLoading(false));
  }, [term, status, confidence, pageNo]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="panel">
      <h2>Search all runs</h2>
      <p className="small muted">
        Looks across every run on this account &mdash; domain, leader name or the
        email the domain came from.
      </p>

      {error && <div className="notice err">{error}</div>}

      <div className="toolbar">
        <div style={{ flex: '1 1 260px' }}>
          <label htmlFor="q">Domain, leader or email</label>
          <input id="q" type="text" value={q} autoFocus
                 placeholder="silverdollarboats.com"
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-status">Status</label>
          <select id="s-status" value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="">All</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
            <option value="not_found">&nbsp;&nbsp;— Not found</option>
            <option value="error">&nbsp;&nbsp;— Error</option>
            <option value="pending">&nbsp;&nbsp;— Pending</option>
          </select>
        </div>
        <div>
          <label htmlFor="s-conf">Confidence</label>
          <select id="s-conf" value={confidence} onChange={(e) => setConfidence(e.target.value)}>
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low &mdash; check these</option>
            <option value="manual">Manually set</option>
          </select>
        </div>
      </div>

      {q.trim().length > 0 && q.trim().length < 2 && (
        <p className="muted small">Keep typing &mdash; at least two characters.</p>
      )}

      {page && (
        <>
          <p className="small muted">
            {page.total} match{page.total === 1 ? '' : 'es'}
            {loading && ' · searching...'}
          </p>
          <ResultsTable rows={page.items} showRun onChanged={load} />
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
  );
}

export default function SearchPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<p className="muted">Loading...</p>}>
      <SearchView />
    </Suspense>
  );
}
