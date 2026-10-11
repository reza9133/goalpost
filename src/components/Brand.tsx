export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="brand__mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M7 4v24" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M7 12h18" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M25 12v16" stroke="var(--moved)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
