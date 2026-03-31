export function Skeleton({ width = '100%', height = 20, radius = 8, style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <Skeleton width="40%" height={14} style={{ marginBottom: 12 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Skeleton width={56} height={56} radius="50%" />
        <Skeleton width={30} height={16} />
        <Skeleton width={56} height={56} radius="50%" />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${80 - i * 15}%`} height={12} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Skeleton width={40} height={40} radius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
            <Skeleton width="40%" height={10} />
          </div>
          <Skeleton width={60} height={24} radius={12} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card" style={{ padding: 16, textAlign: 'center' }}>
          <Skeleton width="50%" height={10} style={{ margin: '0 auto 8px' }} />
          <Skeleton width="70%" height={24} style={{ margin: '0 auto' }} />
        </div>
      ))}
    </div>
  );
}
