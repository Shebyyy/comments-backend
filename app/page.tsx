export default function RootPage() {
  return (
    <div style={{ 
      padding: '2rem', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h1>🚀 AnymeX Comments Backend API</h1>
      
      <h2>Available Endpoints</h2>
      <ul>
        <li><strong>GET /api/comments</strong> - Fetch comments</li>
        <li><strong>POST /api/comments</strong> - Create comment</li>
        <li><strong>POST /api/comments/vote</strong> - Vote on comment</li>
        <li><strong>DELETE /api/comments/[id]</strong> - Delete comment</li>
        <li><strong>GET /api/db/migrate</strong> - Run database migration</li>
      </ul>

      <h2>Quick Test</h2>
      <p>Try: <code>GET /api/comments?media_id=1</code></p>

      <h2>Documentation</h2>
      <p>See the project README for full API documentation.</p>
    </div>
  );
}