import { useEffect, useRef, useState, type ReactNode } from 'react';

import { shortHex } from '../lib/format';

export function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" className="btn btn--quiet btn--small" onClick={() => void copy()} aria-live="polite">
      {copied ? 'Copied' : label}
    </button>
  );
}

export function HashValue({ value, head = 10, tail = 8 }: { value: string; head?: number; tail?: number }) {
  return (
    <span className="hashvalue">
      <code title={value}>{shortHex(value, head, tail)}</code>
      <CopyButton value={value} />
    </span>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'error';
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'note'}>
      {title && <strong className="notice__title">{title}</strong>}
      {children && <div className="notice__body">{children}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading from the network' }: { label?: string }) {
  return (
    <p className="loading" role="status">
      <span className="loading__dot" aria-hidden="true" />
      {label}
    </p>
  );
}
