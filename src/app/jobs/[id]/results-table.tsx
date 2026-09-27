'use client';

import { useState } from 'react';
import { api, DomainResult } from '@/lib/api';

const TITLES = ['CEO', 'Chief Executive', 'President', 'Managing Director'];

export function ResultsTable({
  jobId, rows, onChanged,
}: {
  jobId: string;
  rows: DomainResult[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftTitle, setDraftTitle] = useState('CEO');
  const [saving, setSaving] = useState(false);

  function startEdit(r: DomainResult) {
    setEditing(r.id);
    setDraftName(r.leaderName ?? '');
    setDraftTitle(r.title ?? 'CEO');
  }

  async function save(resultId: string) {
    setSaving(true);
    try {
      await api.review(jobId, resultId, {
        leaderName: draftName.trim(),
        title: draftTitle,
        status: draftName.trim() ? 'resolved' : 'not_found',
      });
      setEditing(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (!rows.length) return <p className="muted small">Nothing matches this filter.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: '22%' }}>Domain</th>
          <th style={{ width: '20%' }}>Leader</th>
          <th style={{ width: '14%' }}>Title</th>
          <th style={{ width: '10%' }}>Status</th>
          <th style={{ width: '10%' }}>Confidence</th>
          <th>Evidence</th>
          <th style={{ width: '70px' }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const isEditing = editing === r.id;
          return (
            <tr key={r.id}>
              <td className="domain">
                <a href={`https://${r.domain}`} target="_blank" rel="noreferrer">{r.domain}</a>
              </td>

              <td>
                {isEditing ? (
                  <input type="text" value={draftName} autoFocus
                         onChange={(e) => setDraftName(e.target.value)}
                         placeholder="Leave blank to mark not found" />
                ) : (
                  <>
                    {r.leaderName ?? <span className="muted">&mdash;</span>}
                    {r.competingNames?.length > 0 && (
                      <div className="small muted">also seen: {r.competingNames.join(', ')}</div>
                    )}
                  </>
                )}
              </td>

              <td>
                {isEditing ? (
                  <select value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}>
                    {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (r.title ?? <span className="muted">&mdash;</span>)}
              </td>

              <td><span className={`tag ${r.status}`}>{r.status.replace('_', ' ')}</span></td>

              <td>
                {r.confidence
                  ? <span className={`tag ${r.confidence}`}>{r.confidence}</span>
                  : <span className="muted">&mdash;</span>}
              </td>

              <td className="small">
                {r.message
                  ? <span className="muted">{r.message}</span>
                  : (
                    <>
                      <span className="muted">{r.evidence?.join(', ')}</span>
                      {r.sources?.length > 0 && (
                        <div>
                          {r.sources.map((s, i) => (
                            <a key={s} href={s} target="_blank" rel="noreferrer" className="mono"
                               style={{ marginRight: 8 }}>
                              source {i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
              </td>

              <td>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="small primary" disabled={saving} onClick={() => save(r.id)}>Save</button>
                    <button className="small" disabled={saving} onClick={() => setEditing(null)}>x</button>
                  </div>
                ) : (
                  <button className="small" onClick={() => startEdit(r)}>Edit</button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
