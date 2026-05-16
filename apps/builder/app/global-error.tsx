'use client';

// Overrides Next 16's auto-generated `/_global-error` page. The auto-generated
// version tripped an `Expected workStore to be initialized` invariant during
// static export — providing our own keeps SSG happy.

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <main
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            color: '#0a0a0a',
            background: '#f5f5f5',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: '#6b7280', maxWidth: '32rem', textAlign: 'center' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d4d4d4',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
