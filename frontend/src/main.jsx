import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CrowdShield Command Center Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh', padding: '40px', fontFamily: 'monospace' }}>
          <h2 style={{ color: '#ef4444', fontSize: '20px', fontWeight: 'bold' }}>SYSTEM RECOVERY CONSOLE</h2>
          <p style={{ color: '#a1a1aa', marginTop: '10px' }}>An unexpected UI runtime exception was intercepted:</p>
          <pre style={{ backgroundColor: '#18181b', padding: '15px', borderRadius: '6px', color: '#f87171', overflowX: 'auto', marginTop: '10px' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#22c55e', color: '#000000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            RELOAD COMMAND CENTER
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
