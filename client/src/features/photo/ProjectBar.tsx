import { useState, useEffect } from "react";
import { getPhotoState, loadPhotoState } from "./state/serialize";

export default function ProjectBar() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    try {
      const r = await fetch("/api/scenes", { credentials: "include" }).then(r => r.json());
      if (r.ok) setList(r.scenes);
    } catch (error) {
      console.error("Failed to load scenes:", error);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      const body = { 
        name: name || `Project ${new Date().toLocaleString()}`, 
        state: getPhotoState() 
      };
      
      const response = await fetch("/api/scenes", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        setName("");
        refresh();
      } else {
        alert("Failed to save project");
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save project");
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const r = await fetch(`/api/scenes/${id}`, { credentials: "include" }).then(r => r.json());
      if (r.ok) {
        loadPhotoState(r.scene.state);
      } else {
        alert("Failed to load project");
      }
    } catch (error) {
      console.error("Load error:", error);
      alert("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center p-2 border-b bg-gray-50">
      <input 
        placeholder="Project name" 
        value={name} 
        onChange={e => setName(e.target.value)}
        className="border px-2 py-1 rounded text-sm"
        disabled={loading}
      />
      <button 
        onClick={handleSave}
        disabled={loading || !name.trim()}
        className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save"}
      </button>
      <select 
        onChange={e => handleLoad(e.target.value)}
        disabled={loading}
        className="border px-2 py-1 rounded text-sm"
      >
        <option value="">Load…</option>
        {list.map(s => (
          <option key={s.id} value={s.id}>
            {s.name} ({new Date(s.updated_at).toLocaleDateString()})
          </option>
        ))}
      </select>
      <button 
        onClick={refresh}
        disabled={loading}
        className="px-2 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
      >
        ↻
      </button>
    </div>
  );
}
