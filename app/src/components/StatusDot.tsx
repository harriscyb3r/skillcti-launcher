import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export default function StatusDot() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 10_000,
    retry: false,
  })

  const ok = !isError && data?.ok
  const apiKeySet = data?.api_key_set

  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          'w-[7px] h-[7px] rounded-full transition-all duration-300 flex-shrink-0',
          ok ? 'bg-green shadow-[0_0_8px_#22c55e]' : 'bg-txt-3',
        ].join(' ')}
      />
      <span className="text-[11px] text-txt-3 tracking-[0.07em]">
        {ok
          ? apiKeySet
            ? 'backend online'
            : 'no api key'
          : 'backend offline'}
      </span>
    </div>
  )
}
