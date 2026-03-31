import { Component } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container page-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 200px)', textAlign: 'center' }}>
          <div className="anim-in" style={{ marginBottom: 32 }}>
            <div style={{ fontSize: '4rem', marginBottom: 12, opacity: 0.4 }}>💥</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 24px' }}>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <code style={{ display: 'block', padding: '12px 16px', background: 'rgba(255,0,0,0.1)', borderRadius: 8, fontSize: '0.75rem', color: '#ff6b6b', maxWidth: 400, margin: '0 auto', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'Unknown error'}
            </code>
          </div>
          <div className="anim-in anim-d1" style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => window.history.back()}>
              <ArrowLeft size={16} /> Go Back
            </button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
