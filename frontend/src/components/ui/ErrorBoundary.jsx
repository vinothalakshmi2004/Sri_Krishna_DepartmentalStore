import { Component } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

/**
 * Catches unexpected errors anywhere below it and shows a friendly
 * "Reload page" screen instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[app] Unexpected error:', error, info && info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mint px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <TriangleAlert className="size-8" />
        </span>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-sm text-slate-600">
          Please reload the page. If this keeps happening, restart the website (close and run <strong>npm run dev</strong> again).
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-on-brand shadow-soft transition hover:bg-brand-600"
        >
          <RefreshCw className="size-4" /> Reload page
        </button>
        {import.meta.env.DEV && (
          <pre className="mt-2 max-w-xl overflow-auto rounded-xl bg-white p-3 text-left text-xs text-red-600 shadow-card">{String(error.message || error)}</pre>
        )}
      </div>
    );
  }
}
