import { useSearchParams } from 'react-router-dom';

export function useRoomTree() {
  const [searchParams, setSearchParams] = useSearchParams();
  const expandedIds = searchParams.get('expand')?.split(',').filter(Boolean) ?? [];
  const selectedId = searchParams.get('selected') ?? null;

  const toggleExpand = (id: string) => {
    const next = expandedIds.includes(id)
      ? expandedIds.filter(x => x !== id)
      : [...expandedIds, id];
    const params = new URLSearchParams();
    if (next.length) params.set('expand', next.join(','));
    if (selectedId) params.set('selected', selectedId);
    setSearchParams(params, { replace: true });
  };

  const selectRoom = (id: string) => {
    const params = new URLSearchParams();
    if (expandedIds.length) params.set('expand', expandedIds.join(','));
    params.set('selected', id);
    setSearchParams(params, { replace: true });
  };

  return { expandedIds, selectedId, toggleExpand, selectRoom };
}
