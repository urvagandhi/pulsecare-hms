export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Top Header Skeleton */}
      <div className="flex items-center justify-between pb-2">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-3 shadow-sm"
          >
            <div className="flex justify-between items-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800" />
              <div className="w-14 h-5 rounded-full bg-slate-100 dark:bg-slate-800" />
            </div>
            <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Split Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 w-full bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center px-4 gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="w-16 h-6 rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-50 dark:bg-slate-800/50" />
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="h-5 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-50 dark:bg-slate-800/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton({ title = 'Loading Records...' }: { title?: string }) {
  return (
    <div className="space-y-6 animate-pulse p-1" aria-label={title}>
      <div className="flex items-center justify-between pb-2">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="h-10 w-72 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardSkeleton;

