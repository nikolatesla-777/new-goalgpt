export function InPlayGuruPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 60px)' }}>
      <iframe
        src="/inplayguru/"
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          minHeight: 'calc(100vh - 60px)',
        }}
        title="InPlay Guru"
        allow="same-origin"
      />
    </div>
  );
}
