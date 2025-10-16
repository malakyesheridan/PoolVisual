import React from "react";

export default function PreflightNotice({ items }: { items: Array<{ ok: boolean; label: string; hint?: string }> }) {
  const bad = items.filter(i => !i.ok);
  if (bad.length === 0) return null;
  return (
    <div className="m-4 p-3 border border-amber-300 bg-amber-50 rounded text-sm">
      <div className="font-medium mb-2">Preflight checks failed — fix before editing:</div>
      <ul className="list-disc ml-5">
        {bad.map((i, idx) => (
          <li key={idx}>
            <span className="font-semibold">{i.label}</span>
            {i.hint ? <span className="opacity-70"> — {i.hint}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
