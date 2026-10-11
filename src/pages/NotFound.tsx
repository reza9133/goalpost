import { Link } from 'react-router-dom';

import { useDocumentTitle } from '../lib/hooks';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <div className="empty">
      <h1 className="display display--page">That page does not exist.</h1>
      <p>The address may be mistyped, or the record may live in a different deployment of the contract.</p>
      <Link className="btn" to="/">
        Back to the ledger
      </Link>
    </div>
  );
}
