import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-black p-8">
          <div className="max-w-2xl rounded-lg border border-red-500/50 bg-red-950/20 p-6 text-white">
            <h1 className="mb-4 text-2xl font-bold text-red-400">Application Error</h1>
            <p className="mb-4 text-red-300">
              Something went wrong. Please check the console for details.
            </p>
            {this.state.error && (
              <div className="mb-4 rounded bg-black/50 p-4 font-mono text-sm">
                <p className="mb-2 font-semibold text-red-400">Error:</p>
                <p className="text-red-300">{this.state.error.message}</p>
                {this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-red-400">Stack Trace</summary>
                    <pre className="mt-2 overflow-auto text-xs text-gray-400">
                      {this.state.error.stack}
                      {'\n\n'}
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

