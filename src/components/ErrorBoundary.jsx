import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Aisle] Uncaught error:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: '32px',
            textAlign: 'center',
            backgroundColor: '#0F0D0A',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
          }}
        >
          <div style={{ fontSize: 52, marginBottom: 20 }}>🛍️</div>
          <h2
            style={{
              fontFamily: '"Dela Gothic One", sans-serif',
              fontSize: 22,
              color: '#F0EBE0',
              margin: '0 0 8px',
            }}
          >
            Something went wrong
          </h2>
          <p style={{ color: 'rgba(240,235,224,0.5)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
            Reload the app to get back to your list.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px',
              borderRadius: '100px',
              backgroundColor: '#FF7BAC',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
