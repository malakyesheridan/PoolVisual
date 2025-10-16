import React from "react";

type S = { err?: string };
export default class ErrorBoundary extends React.Component<React.PropsWithChildren, S> {
  state: S = {};
  static getDerivedStateFromError(err: any) { return { err: err?.message || "Render failed" }; }
  componentDidCatch(err:any, info:any) { console.error("[ErrorBoundary]", err, info); }
  render() {
    if (this.state.err) {
      return (
        <div className="m-4 p-3 border border-red-300 bg-red-50 rounded text-sm">
          <div className="font-medium mb-2">Something went wrong in this panel.</div>
          <code className="block text-xs break-words">{this.state.err}</code>
          <button className="mt-2 border px-2 py-1 rounded" onClick={()=>this.setState({err: undefined})}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
