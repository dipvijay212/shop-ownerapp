import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * The Privacy Policy or Terms, fetched from the website every time `enabled`
 * turns on (i.e. every time the sheet opens), so a change on the site shows
 * up on the next open.
 *
 * The saved copy is read first and shown while the fetch runs, so reopening
 * the sheet never sits on a spinner once the document has loaded before.
 *
 * → { doc, offline, loading, failed, retry }
 */
export const useLegalDoc = (kind, enabled) => {
  // Keyed by kind: one sheet switches between Privacy and Terms, and an
  // unkeyed copy showed the Privacy Policy under the Terms title.
  const [saved, setSaved] = useState({});
  const hasSaved = Boolean(saved[kind]);

  useEffect(() => {
    if (!enabled || hasSaved) return undefined;
    let cancelled = false;
    api.legal.readSavedLegalDoc(kind).then((doc) => {
      if (!cancelled && doc) setSaved((prev) => ({ ...prev, [kind]: doc }));
    });
    return () => {
      cancelled = true;
    };
  }, [kind, enabled, hasSaved]);

  const query = useQuery({
    queryKey: ['legal', kind],
    queryFn: () => api.legal.getLegalDoc(kind),
    enabled,
    // Always stale: re-enabling the query on the next open refetches it.
    staleTime: 0,
    // getLegalDoc already falls back to the saved copy; a retry would only
    // delay the error state when there is none.
    retry: 0,
  });

  const doc = query.data?.doc ?? saved[kind] ?? null;

  return {
    doc,
    offline: Boolean(query.data?.offline),
    loading: !doc && query.isFetching,
    failed: !doc && query.isError && !query.isFetching,
    retry: query.refetch,
  };
};
