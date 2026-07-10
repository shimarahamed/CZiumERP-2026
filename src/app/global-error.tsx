'use client';

// Last-resort boundary: catches crashes in the root layout itself.
// Must render its own <html>/<body> because the layout is broken.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error('Global error boundary caught:', error);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, background: '#f6f6f7' }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#555', marginBottom: 16 }}>The application hit an unexpected error. Please retry — if it keeps happening, contact support.</p>
          <button onClick={() => reset()} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#5b21b6', color: '#fff', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
