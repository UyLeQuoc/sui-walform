export default function NotFound() {
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
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>404 — page not found</h1>
      <p style={{ color: '#6b7280' }}>
        Append <code style={{ fontFamily: 'monospace' }}>#/f/&lt;formId&gt;</code> to render a form.
      </p>
    </main>
  );
}
