import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../lib/hooks';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <div className="empty" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.3 }} aria-hidden="true">⌀</div>
      <h1 className="display display--page">That page does not exist.</h1>
      <p>The address may be mistyped, or the record may live in a different deployment of the contract.</p>
      <Link className="btn btn--primary" to="/">
        ← Back to the ledger
      </Link>
    </div>
  );
}
