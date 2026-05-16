'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
      <p style={{ color: '#6b7280', maxWidth: '32rem' }}>
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
  );
}
