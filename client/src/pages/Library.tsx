import { useRef } from 'react';
import { Button } from '../components/ui/button';
import { Plus, Package } from 'lucide-react';
import { MaterialsTab } from '../components/library/MaterialsTab';

export default function Library() {
  // Refs to communicate with tab components
  const materialsTabRef = useRef<{ triggerAdd: () => void }>(null);

  const handleAddClick = () => {
    materialsTabRef.current?.triggerAdd();
  };

  return (
    <div className="bg-slate-50 pb-20 md:pb-0">
      {/* Mobile header */}
      <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold mobile-text-lg">Library</h1>
          <Button
            onClick={handleAddClick}
            className="tap-target"
            size="sm"
            data-testid="button-add-item"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto w-full px-6 pb-10">
        {/* Desktop Header */}
        <header className="pt-8 pb-4">
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
                Library
              </h1>
              <p className="text-slate-600 mt-1">
                Manage your pool renovation materials and assets
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleAddClick}
                data-testid="button-add-item-desktop"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Material
              </Button>
            </div>
          </div>

        </header>

        {/* Content */}
        <div className="tab-content">
          <MaterialsTab ref={materialsTabRef} />
        </div>
      </div>
    </div>
  );
}
