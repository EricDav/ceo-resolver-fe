'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Account {
  balance: number | null;
  serpDepth: number;
  costPerDomain: number;
  estimatedDomains: number | null;
}

/** Shows the DataForSEO balance so nobody starts a run that cannot finish. */
export function AccountBadge() {
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.account().then(setAccount).catch(() => setError(true));
  }, []);

  if (error) return <span className="small muted">API unreachable</span>;
  if (!account || account.balance === null) return <span className="small muted">&nbsp;</span>;

  return (
    <span
      className="small muted"
      title={`depth ${account.serpDepth} — about $${account.costPerDomain.toFixed(4)} per domain. Lower SERP_DEPTH to 10 to halve the cost, at roughly 14% fewer resolved.`}
    >
      DataForSEO balance <strong>${account.balance.toFixed(2)}</strong>
      {account.estimatedDomains !== null && (
        <> &middot; ~{account.estimatedDomains.toLocaleString()} domains at depth {account.serpDepth}</>
      )}
    </span>
  );
}
