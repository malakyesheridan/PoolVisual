import { useState, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Plus, Package, Image, FileText } from 'lucide-react';
import { MaterialsTab } from '../components/library/MaterialsTab';
import { AssetsTab } from '../components/library/AssetsTab';
import { TemplatesTab } from '../components/library/TemplatesTab';

type TabType = 'materials' | 'assets' | 'templates';

export default function Library() {
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  
  // Refs to communicate with tab components
  const materialsTabRef = useRef<{ triggerAdd: () => void }>(null);
  const assetsTabRef = useRef<{ triggerAdd: () => void }>(null);
  const templatesTabRef = useRef<{ triggerAdd: () => void }>(null);

  const tabs = [
    {
      id: 'materials' as TabType,
      label: 'Materials',
      icon: Package,
      description: 'Pool renovation materials and pricing'
    },
    {
      id: 'assets' as TabType,
      label: 'Assets',
      icon: Image,
      description: 'Pool design assets and textures'
    },
    {
      id: 'templates' as TabType,
      label: 'Templates',
      icon: FileText,
      description: 'Pre-designed pool templates'
    }
  ];

  const getAddButtonText = () => {
    switch (activeTab) {
      case 'materials':
        return 'Add Material';
      case 'assets':
        return 'Add Asset';
      case 'templates':
        return 'Add Template';
      default:
        return 'Add Item';
    }
  };

  const handleAddClick = () => {
    // Trigger the appropriate tab's add functionality
    switch (activeTab) {
      case 'materials':
        materialsTabRef.current?.triggerAdd();
        break;
      case 'assets':
        assetsTabRef.current?.triggerAdd();
        break;
      case 'templates':
        templatesTabRef.current?.triggerAdd();
        break;
      default:
        console.log(`Add ${activeTab} clicked - no handler`);
    }
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
      
      <div className="max-w-7xl mx-auto mobile-container md:px-6 mobile-spacing md:py-8">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
              Library
            </h1>
            <p className="text-slate-600 mt-1">
              Manage your pool renovation materials, assets, and templates
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleAddClick}
              data-testid="button-add-item-desktop"
            >
              <Plus className="w-4 h-4 mr-2" />
              {getAddButtonText()}
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'materials' && <MaterialsTab ref={materialsTabRef} />}
          {activeTab === 'assets' && <AssetsTab ref={assetsTabRef} />}
          {activeTab === 'templates' && <TemplatesTab ref={templatesTabRef} />}
        </div>
      </div>
    </div>
  );
}
