// Skeleton shapes — used across the app to replace spinners during loading.
// The `.skeleton` CSS class in index.css provides the shimmer animation.

export function SkeletonLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`skeleton rounded ${h} ${w}`} />
}

export function SkeletonStatCard() {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card px-4 py-3 flex-shrink-0 min-w-[110px]">
      <div className="skeleton h-7 w-12 rounded mb-2" />
      <div className="skeleton h-2.5 w-20 rounded" />
    </div>
  )
}

export function SkeletonReportRow() {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div className="skeleton h-[22px] w-10 rounded flex-shrink-0" />
      <div className="skeleton h-3 rounded flex-1" />
      <div className="skeleton h-3 w-10 rounded flex-shrink-0" />
    </div>
  )
}

export function SkeletonLaunchTile() {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card p-4 flex flex-col gap-2.5">
      <div className="skeleton h-[22px] w-14 rounded" />
      <div className="skeleton h-3.5 w-3/4 rounded mt-0.5" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-3 w-10 rounded mt-1" />
    </div>
  )
}

export function SkeletonSpotlightCard() {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="skeleton h-[18px] w-48 rounded" />
          <div className="skeleton h-2.5 w-28 rounded" />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <div className="skeleton h-5 w-14 rounded" />
          <div className="skeleton h-5 w-20 rounded" />
        </div>
      </div>
      <div className="px-5 py-4 border-b border-border flex flex-col gap-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-3/5 rounded" />
        <div className="flex gap-2 mt-1">
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-5 w-20 rounded" />
          <div className="skeleton h-5 w-14 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-3 flex flex-col gap-2">
            <div className="skeleton h-2.5 w-20 rounded" />
            <div className="skeleton h-5 w-24 rounded" />
            <div className="skeleton h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonPulseCard() {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-col gap-2">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
      <div className="px-4 py-3 flex gap-2 flex-wrap">
        <div className="skeleton h-6 w-28 rounded" />
        <div className="skeleton h-6 w-20 rounded" />
        <div className="skeleton h-6 w-16 rounded" />
      </div>
    </div>
  )
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="skeleton w-2 h-2 rounded-full flex-shrink-0" />
      <div className="skeleton h-3 flex-1 rounded" />
      <div className="skeleton h-3 w-16 rounded flex-shrink-0 hidden sm:block" />
      <div className="skeleton h-3 w-10 rounded flex-shrink-0" />
    </div>
  )
}

export function SkeletonSourceBlock() {
  return (
    <div className="bg-bg border border-border rounded-lg p-3 flex flex-col gap-2">
      <div className="skeleton h-2.5 w-16 rounded" />
      <div className="flex items-center gap-2">
        <div className="skeleton w-[7px] h-[7px] rounded-full flex-shrink-0" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
      <div className="skeleton h-1.5 w-full rounded-full" />
      <div className="skeleton h-3 w-3/4 rounded" />
    </div>
  )
}

export function SkeletonCVECard() {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-5 w-20 rounded" />
        <div className="skeleton h-5 w-24 rounded" />
        <div className="skeleton h-3 w-28 rounded ml-auto" />
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-4/6 rounded" />
        <div className="flex gap-1.5 mt-1">
          <div className="skeleton h-6 w-24 rounded" />
          <div className="skeleton h-6 w-20 rounded" />
        </div>
      </div>
    </div>
  )
}
