import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{
        fontFamily: 'sans-serif', padding: '2rem', maxWidth: '600px',
        margin: '2rem auto', background: '#fff1f2', borderRadius: '8px',
        border: '1px solid #fca5a5',
      }}>
        <h2 style={{ color: '#dc2626', marginTop: 0 }}>Stitchify failed to start</h2>
        <p style={{ color: '#333' }}>
          Something crashed on startup. Please take a screenshot of this and report it.
        </p>
        <pre style={{
          background: '#fff', padding: '1rem', borderRadius: '4px',
          fontSize: '12px', overflow: 'auto', color: '#991b1b',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          style={{
            marginTop: '1rem', padding: '0.5rem 1rem', background: '#dc2626',
            color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          Clear storage &amp; reload
        </button>
      </div>
    );
  }
}
