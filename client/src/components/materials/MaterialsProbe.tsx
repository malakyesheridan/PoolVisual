import { useState, useEffect } from 'react';
import { debugMaterials, createMaterialForce, listMaterialsForce } from '../../lib/materialsForceApi';
import { useMaterialsStore } from '../../stores/materialsStore';
import { Button } from '../ui/button';

export function MaterialsProbe() {
  const upsert = useMaterialsStore(s => s.upsert);
  const [dbg, setDbg] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    debugMaterials()
      .then(setDbg)
      .catch(e => setDbg({ ok: false, error: e.message }));
  }, []);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev.slice(-4), result]); // Keep last 5 results
  };

  return (
    <div className="mt-6 p-4 rounded border-2 border-green-200 bg-green-50 text-sm">
      <h3 className="font-bold text-green-800 mb-2">🧪 Materials Force Save Probe</h3>
      
      <div className="space-y-1 mb-3">
        <div>Database: <span className={dbg?.ok ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
          {dbg?.ok ? "✅ CONNECTED" : "❌ FAILED"}
        </span></div>
        {dbg?.error && <div className="text-red-600">Error: {dbg.error}</div>}
        <div>Materials count: <span className="font-mono">{dbg?.count ?? '—'}</span></div>
        <div>Last check: <span className="font-mono text-xs">{dbg?.timestamp}</span></div>
      </div>

      <div className="flex gap-2 mb-3">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const testName = `ForceTest-${Date.now()}`;
              console.log('[probe] Testing force save with name:', testName);
              
              const created = await createMaterialForce({
                name: testName,
                category: 'waterline_tile',
                unit: 'm2',
                price: '123.45',
                supplier: 'ProbeTest'
              });
              
              console.log('[probe] Force save result:', created);
              
              if (!created?.id) {
                throw new Error('No ID returned from force save');
              }
              
              // Update store immediately
              upsert(created);
              
              addTestResult(`✅ ${new Date().toLocaleTimeString()}: Created ${created.id.slice(0, 8)}...`);
              
            } catch (e: any) {
              console.error('[probe] Force save failed:', e);
              addTestResult(`❌ ${new Date().toLocaleTimeString()}: ${e.message}`);
            } finally {
              setBusy(false);
            }
          }}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          {busy ? "Testing..." : "🚀 Test Force Save"}
        </Button>

        <Button
          onClick={() => window.open('/api/_materials/debug', '_blank')}
          variant="outline"
          size="sm"
        >
          📊 Debug JSON
        </Button>
      </div>

      {testResults.length > 0 && (
        <div className="bg-white p-2 rounded border">
          <div className="text-xs font-bold mb-1">Test Results:</div>
          {testResults.map((result, i) => (
            <div key={i} className="font-mono text-xs">{result}</div>
          ))}
        </div>
      )}
    </div>
  );
}