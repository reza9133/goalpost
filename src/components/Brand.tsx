export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand__mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gp-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--ink)" />
          <stop offset="100%" stopColor="var(--ink-2)" />
        </linearGradient>
        <linearGradient id="gp-moved" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--moved)" />
          <stop offset="100%" stopColor="#e8603a" />
        </linearGradient>
      </defs>
      <path d="M7 4v24" stroke="url(#gp-grad)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M7 12h18" stroke="url(#gp-grad)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M25 12v16" stroke="url(#gp-moved)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
