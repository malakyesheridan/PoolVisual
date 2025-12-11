import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const boundaryName = this.props.name || 'ErrorBoundary';
    console.error(`${boundaryName} caught error:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          maxWidth: '600px',
          margin: '100px auto'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#666', marginBottom: '24px' }}>
            We've logged the error and will look into it.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                background: 'white'
              }}
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                background: '#0066cc',
                color: 'white'
              }}
            >
              Refresh Page
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '24px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
                Error Details
              </summary>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Export alias for App.tsx compatibility
export const AppErrorBoundary = ErrorBoundary;
