export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* Left fixed upright */}
      <path d="M7 4v24" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      {/* Crossbar */}
      <path d="M7 12h18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      {/* Right moved upright (signal color) */}
      <path d="M25 12v16" stroke="var(--moved, #dc4a20)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
