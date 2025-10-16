import React from "react";

type S = { error?: string };

export default class PhotoErrorBoundary extends React.Component<React.PropsWithChildren, S> {
  state: S = {};
  
  static getDerivedStateFromError(err: any) { 
    return { error: err?.message || "Preview failed" }; 
  }
  
  componentDidCatch(err: any, info: any) { 
    console.error("[Photo] error boundary:", err, info); 
  }
  
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
          Photorealistic preview failed to render.<br/>
          <code className="text-xs">{this.state.error}</code>
          <div className="mt-2">
            <button 
              className="border px-2 py-1 rounded hover:bg-red-100" 
              onClick={() => this.setState({ error: undefined })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
