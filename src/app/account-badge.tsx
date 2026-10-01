'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Account {
  configured?: boolean;
  balance: number | null;
  serpDepth: number;
  costPerDomain: number;
  estimatedDomains: number | null;
  /** DataForSEO answered badly. The API itself is fine. */
  error?: string;
}

/**
 * Shows the DataForSEO balance so nobody starts a run that cannot finish.
 * Refreshes periodically, because a run burns the balance down as it goes.
 */
export function AccountBadge() {
  const [account, setAccount] = useState<Account | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    const load = () =>
      api.account()
        .then((a) => { setAccount(a as Account); setDown(false); })
        .catch(() => setDown(true));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (down) return <span className="small muted">API unreachable</span>;
  if (!account) return <span className="small muted">&nbsp;</span>;

  if (account.configured === false) {
    return <span className="small muted">No DataForSEO credentials set</span>;
  }
  if (account.balance === null) {
    return (
      <span className="small muted" title={account.error}>
        DataForSEO balance unavailable
      </span>
    );
  }

  // Out of credit is the one state worth shouting about: every run 402s.
  const broke = account.balance <= 0;

  return (
    <span
      className={`small ${broke ? 'err' : 'muted'}`}
      title={`depth ${account.serpDepth} — about $${account.costPerDomain.toFixed(4)} per domain. Lower SERP_DEPTH to 10 to halve the cost, at roughly 14% fewer resolved.`}
    >
      DataForSEO balance <strong>${account.balance.toFixed(2)}</strong>
      {broke
        ? ' — top up before starting a run'
        : account.estimatedDomains !== null && (
            <> &middot; ~{account.estimatedDomains.toLocaleString()} domains at depth {account.serpDepth}</>
          )}
    </span>
  );
}
