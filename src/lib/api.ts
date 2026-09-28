export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export type JobStatus =
  | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type ResultStatus = 'pending' | 'resolved' | 'not_found' | 'error';
/** 'unresolved' spans not_found + error + pending. */
export type StatusFilter = ResultStatus | 'unresolved' | '';

export interface StatusCounts {
  resolved: number;
  not_found: number;
  error: number;
  pending: number;
  unresolved: number;
}

export interface Job {
  id: string;
  name: string;
  status: JobStatus;
  totalDomains: number;
  processed: number;
  resolved: number;
  notFound: number;
  errored: number;
  cacheHits: number;
  costUsd: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DomainResult {
  id: string;
  domain: string;
  status: ResultStatus;
  leaderName: string | null;
  title: string | null;
  confidence: string | null;
  votes: number;
  evidence: string[];
  sources: string[];
  competingNames: string[];
  message: string | null;
  reviewed: boolean;
  mailStatus: string;
  mailProvider: string | null;
}

export interface Deliverability {
  deliverable: number;
  undeliverable: number;
  byStatus: Record<string, number>;
  providers: Array<{ provider: string; count: number }>;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function headers(extra: Record<string, string> = {}) {
  const key = process.env.NEXT_PUBLIC_API_KEY;
  return key ? { ...extra, 'x-api-key': key } : extra;
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      /* body was not JSON */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listJobs: () => fetch(`${API_URL}/api/jobs`, { headers: headers(), cache: 'no-store' }).then(unwrap<Job[]>),

  getJob: (id: string) =>
    fetch(`${API_URL}/api/jobs/${id}`, { headers: headers(), cache: 'no-store' }).then(unwrap<Job>),

  createJob: (body: { name?: string; text?: string; skipAlreadyResolved?: boolean }) =>
    fetch(`${API_URL}/api/jobs`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(unwrap<Job>),

  uploadJob: (file: File, name: string, skipAlreadyResolved: boolean) => {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    form.append('skipAlreadyResolved', String(skipAlreadyResolved));
    return fetch(`${API_URL}/api/jobs`, { method: 'POST', headers: headers(), body: form }).then(unwrap<Job>);
  },

  results: (id: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    return fetch(`${API_URL}/api/jobs/${id}/results?${qs}`, { headers: headers(), cache: 'no-store' })
      .then(unwrap<Page<DomainResult>>);
  },

  action: (id: string, verb: 'resume' | 'retry-errors' | 'cancel' | 'pause') =>
    fetch(`${API_URL}/api/jobs/${id}/${verb}`, { method: 'POST', headers: headers() }).then(unwrap<unknown>),

  review: (id: string, resultId: string, body: Record<string, unknown>) =>
    fetch(`${API_URL}/api/jobs/${id}/results/${resultId}`, {
      method: 'PATCH',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(unwrap<DomainResult>),

  deleteJob: (id: string) =>
    fetch(`${API_URL}/api/jobs/${id}`, { method: 'DELETE', headers: headers() }).then(unwrap<unknown>),

  account: () =>
    fetch(`${API_URL}/api/account`, { headers: headers(), cache: 'no-store' }).then(
      unwrap<{
        login: string;
        balance: number | null;
        serpDepth: number;
        costPerDomain: number;
        estimatedDomains: number | null;
      }>,
    ),

  deliverability: (id: string) =>
    fetch(`${API_URL}/api/jobs/${id}/deliverability`, { headers: headers(), cache: 'no-store' })
      .then(unwrap<Deliverability>),

  statusCounts: (id: string) =>
    fetch(`${API_URL}/api/jobs/${id}/status-counts`, { headers: headers(), cache: 'no-store' })
      .then(unwrap<StatusCounts>),

  /**
   * Downloads an export.
   *
   * A plain <a href> cannot carry the x-api-key header, so the browser would
   * navigate unauthenticated and the API would answer 401. Fetch it with the
   * header instead and save the response as a blob.
   *
   * The alternative — putting the key in the query string — would leak it into
   * browser history, server logs and Referer headers, so it is not used.
   */
  download: async (
    id: string,
    format: 'csv' | 'json',
    opts: { status?: StatusFilter; detail?: 'full'; mailStatus?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (opts.status) qs.set('status', opts.status);
    if (opts.detail) qs.set('detail', opts.detail);
    if (opts.mailStatus) qs.set('mailStatus', opts.mailStatus);
    const q = qs.toString();

    const res = await fetch(
      `${API_URL}/api/jobs/${id}/export.${format}${q ? `?${q}` : ''}`,
      { headers: headers() },
    );
    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }

    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const filename = match?.[1] ?? `leaders-${id}.${format}`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a moment to start the save before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

// ---------------------------------------------------------------------------
// Admin
//
// The admin key is typed in by an operator and kept in sessionStorage for the
// tab's lifetime only. It is deliberately NOT a NEXT_PUBLIC_ variable: baking
// it into the bundle would hand full tenant control to anyone who loads the
// page.
// ---------------------------------------------------------------------------

const ADMIN_KEY_STORAGE = 'resolver.adminKey';

export const adminKey = {
  get(): string {
    try {
      return sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? '';
    } catch {
      return '';
    }
  },
  set(key: string) {
    try {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    } catch {
      /* private mode */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    } catch {
      /* private mode */
    }
  },
};

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  apiKeyHint: string;
  dataforseoLogin: string | null;
  hasCredentials: boolean;
  monthlyCapUsd: number;
  perJobCapUsd: number;
  serpDepth: number;
  active: boolean;
  createdAt: string;
  spendThisMonth?: number;
}

export interface TenantWithKey extends Tenant {
  /** Present only on create and rotate. Never retrievable afterwards. */
  apiKey: string;
}

function adminHeaders(extra: Record<string, string> = {}) {
  return { ...extra, 'x-admin-key': adminKey.get() };
}

export const admin = {
  listTenants: () =>
    fetch(`${API_URL}/api/admin/tenants`, { headers: adminHeaders(), cache: 'no-store' })
      .then(unwrap<Tenant[]>),

  createTenant: (body: Record<string, unknown>) =>
    fetch(`${API_URL}/api/admin/tenants`, {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(unwrap<TenantWithKey>),

  updateTenant: (id: string, body: Record<string, unknown>) =>
    fetch(`${API_URL}/api/admin/tenants/${id}`, {
      method: 'PATCH',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(unwrap<Tenant>),

  rotateKey: (id: string) =>
    fetch(`${API_URL}/api/admin/tenants/${id}/rotate-key`, {
      method: 'POST',
      headers: adminHeaders(),
    }).then(unwrap<TenantWithKey>),
};
