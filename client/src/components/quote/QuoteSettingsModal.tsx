import React, { useState } from 'react';
import { useMaskStore } from '../../maskcore/store';
import { X, Save } from 'lucide-react';

interface QuoteSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuoteSettingsModal({ isOpen, onClose }: QuoteSettingsModalProps) {
  const { quoteSettings, UPDATE_QUOTE_SETTINGS } = useMaskStore();
  
  const [settings, setSettings] = useState({
    defaultMarkup: quoteSettings.defaultMarkup,
    defaultTaxRate: quoteSettings.defaultTaxRate,
    defaultLaborCost: quoteSettings.defaultLaborCost,
    // Company info for PDFs
    companyName: 'Pool Design Pro',
    companyAddress: '123 Pool Street, Pool City, PC 12345',
    companyPhone: '(555) 123-POOL',
    companyEmail: 'quotes@pooldesignpro.com'
  });

  const handleSave = () => {
    UPDATE_QUOTE_SETTINGS({
      defaultMarkup: settings.defaultMarkup,
      defaultTaxRate: settings.defaultTaxRate,
      defaultLaborCost: settings.defaultLaborCost
    });
    
    // Save company info to localStorage for PDF generation
    localStorage.setItem('quoteCompanyInfo', JSON.stringify({
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyEmail: settings.companyEmail
    }));
    
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Quote Settings</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Default Pricing Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Default Pricing</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Markup (%)
                </label>
                <input
                  type="number"
                  value={settings.defaultMarkup}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultMarkup: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  step="0.1"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage markup applied to material + labor costs</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={settings.defaultTaxRate}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultTaxRate: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  step="0.1"
                  min="0"
                  max="50"
                />
                <p className="text-xs text-gray-500 mt-1">Tax rate applied to subtotal</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Labor Cost ($/m²)
                </label>
                <input
                  type="number"
                  value={settings.defaultLaborCost}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultLaborCost: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  step="0.01"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">Labor cost per square meter</p>
              </div>
            </div>
          </div>

          {/* Company Information */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Company Information</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Your Company Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Address
                </label>
                <textarea
                  value={settings.companyAddress}
                  onChange={(e) => setSettings(prev => ({ ...prev, companyAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={settings.companyPhone}
                    onChange={(e) => setSettings(prev => ({ ...prev, companyPhone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.companyEmail}
                    onChange={(e) => setSettings(prev => ({ ...prev, companyEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="quotes@company.com"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            onKeyDown={handleKeyPress}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center space-x-2"
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
