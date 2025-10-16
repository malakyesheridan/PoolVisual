import React, { useState, useEffect } from 'react';
import { useMaskStore, Quote } from '../../maskcore/store';
import { useEditorStore } from '../../new_editor/store';
import { useProjectStore } from '../../stores/projectStore';
import { QuoteItem } from './QuoteItem';
import { QuoteShareModal } from './QuoteShareModal';
import { QuoteSettingsModal } from './QuoteSettingsModal';
import { generateQuotePDF } from '../../utils/quotePDFGenerator';
import { Plus, FileText, Settings, Send, Download, Edit2, Trash2, Zap, RefreshCw } from 'lucide-react';

interface QuotePanelProps {
  className?: string;
}

export function QuotePanel({ className = '' }: QuotePanelProps) {
  const { 
    quotes, 
    activeQuoteId, 
    masks,
    CREATE_QUOTE, 
    UPDATE_QUOTE, 
    DELETE_QUOTE, 
    SET_ACTIVE_QUOTE,
    ADD_QUOTE_ITEM,
    UPDATE_QUOTE_SETTINGS,
    quoteSettings
  } = useMaskStore();
  
  const { calibration } = useEditorStore();
  const { project, currentPhoto } = useProjectStore();
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [newQuoteName, setNewQuoteName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  const activeQuote = activeQuoteId ? quotes[activeQuoteId] : null;
  const quoteArray = Object.values(quotes).sort((a, b) => b.createdAt - a.createdAt);

  // Auto-generate quote name based on project context
  useEffect(() => {
    if (project && currentPhoto && !newQuoteName) {
      const photoName = currentPhoto.name || `Photo ${currentPhoto.id.slice(-8)}`;
      const projectName = project.name || `Job ${project.jobId}`;
      setNewQuoteName(`${projectName} - ${photoName}`);
    }
  }, [project, currentPhoto, newQuoteName]);

  const handleCreateQuote = () => {
    if (newQuoteName.trim()) {
      CREATE_QUOTE(newQuoteName.trim());
      setNewQuoteName('');
      setShowCreateQuote(false);
    }
  };

  const handleAutoGenerateQuote = async () => {
    if (!project || !currentPhoto) {
      alert('No project or photo context available');
      return;
    }

    setIsAutoGenerating(true);
    
    try {
      // Create quote with project context
      const quoteName = newQuoteName.trim() || `${project.name} - ${currentPhoto.name}`;
      CREATE_QUOTE(quoteName);
      
      // Get the newly created quote
      const newQuote = Object.values(quotes).find(q => q.name === quoteName);
      if (newQuote) {
        // Auto-add all masks with materials to the quote
        const masksWithMaterials = Object.values(masks).filter(mask => 
          mask.materialId && mask.isVisible !== false
        );
        
        for (const mask of masksWithMaterials) {
          ADD_QUOTE_ITEM(newQuote.id, mask.id, mask.materialId, calibration.pixelsPerMeter);
        }
        
        // Set as active quote
        SET_ACTIVE_QUOTE(newQuote.id);
        
        // Update project with quote reference
        if (project) {
          // TODO: Update project with quote reference when backend is ready
          console.log('[QuotePanel] Auto-generated quote for project:', project.id);
        }
      }
      
      setNewQuoteName('');
      setShowCreateQuote(false);
    } catch (error) {
      console.error('[QuotePanel] Auto-generate quote error:', error);
      alert('Error auto-generating quote. Please try again.');
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateQuote();
    } else if (e.key === 'Escape') {
      setShowCreateQuote(false);
      setNewQuoteName('');
    }
  };

  const handleAddMaskToQuote = (maskId: string) => {
    if (!activeQuote) return;
    
    const mask = masks[maskId];
    if (!mask || !mask.materialId) return;
    
    ADD_QUOTE_ITEM(activeQuote.id, maskId, mask.materialId, calibration.pixelsPerMeter);
  };

  const handleDownloadPDF = () => {
    if (!activeQuote) return;
    
    try {
      // Get saved company info from localStorage
      const savedCompanyInfo = localStorage.getItem('quoteCompanyInfo');
      const companyInfo = savedCompanyInfo ? JSON.parse(savedCompanyInfo) : {
        companyName: 'Pool Design Pro',
        companyAddress: '123 Pool Street, Pool City, PC 12345',
        companyPhone: '(555) 123-POOL',
        companyEmail: 'quotes@pooldesignpro.com'
      };
      
      generateQuotePDF(activeQuote, companyInfo);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleShareQuote = () => {
    if (!activeQuote) return;
    setShowShareModal(true);
  };

  const getMaskName = (maskId: string) => {
    const mask = masks[maskId];
    return mask?.name || `Mask ${Object.keys(masks).indexOf(maskId) + 1}`;
  };

  const getAvailableMasks = () => {
    return Object.values(masks).filter(mask => 
      mask.materialId && 
      mask.isVisible !== false &&
      !activeQuote?.items.some(item => item.maskId === mask.id)
    );
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Quote Generation</h3>
          {project && (
            <p className="text-xs text-gray-500 mt-1">
              Project: {project.name} {currentPhoto && `• Photo: ${currentPhoto.name}`}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Quote settings"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={() => setShowCreateQuote(true)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Create new quote"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Project Context Info */}
      {project && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-xs text-blue-800">
              <div className="font-medium">{project.client.name}</div>
              <div>{project.client.email}</div>
            </div>
            <div className="text-xs text-blue-600">
              {Object.values(masks).filter(m => m.materialId && m.isVisible !== false).length} masks ready for quoting
            </div>
          </div>
        </div>
      )}

      {/* Create Quote Input */}
      {showCreateQuote && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <input
            type="text"
            placeholder="Quote name..."
            value={newQuoteName}
            onChange={(e) => setNewQuoteName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCreateQuote(false)}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuote}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Create Empty
              </button>
            </div>
            
            {/* Auto-Generate Button */}
            {project && Object.values(masks).some(m => m.materialId && m.isVisible !== false) && (
              <button
                onClick={handleAutoGenerateQuote}
                disabled={isAutoGenerating}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {isAutoGenerating ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Zap size={12} />
                    <span>Auto-Generate</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quote Settings Modal */}
      {showSettings && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quote Settings</h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600">Default Markup (%)</label>
              <input
                type="number"
                value={quoteSettings.defaultMarkup}
                onChange={(e) => UPDATE_QUOTE_SETTINGS({ defaultMarkup: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Default Tax Rate (%)</label>
              <input
                type="number"
                value={quoteSettings.defaultTaxRate}
                onChange={(e) => UPDATE_QUOTE_SETTINGS({ defaultTaxRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                step="0.1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Default Labor Cost ($/m²)</label>
              <input
                type="number"
                value={quoteSettings.defaultLaborCost}
                onChange={(e) => UPDATE_QUOTE_SETTINGS({ defaultLaborCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                step="0.01"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setShowSettings(false)}
              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Quote List */}
      {quoteArray.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-600 mb-2">Quotes</h4>
          <div className="space-y-1">
            {quoteArray.map(quote => (
              <div
                key={quote.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                  activeQuoteId === quote.id 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => SET_ACTIVE_QUOTE(quote.id)}
              >
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-900">{quote.name}</div>
                  <div className="text-xs text-gray-500">
                    {quote.items.length} items • ${quote.total.toFixed(2)} • {quote.status}
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      DELETE_QUOTE(quote.id);
                    }}
                    className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
                    title="Delete quote"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Quote Details */}
      {activeQuote ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">{activeQuote.name}</h4>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleShareQuote}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Send quote"
              >
                <Send size={14} />
              </button>
              <button
                onClick={handleDownloadPDF}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Download PDF"
              >
                <Download size={14} />
              </button>
            </div>
          </div>

          {/* Quote Items */}
          <div className="space-y-2 mb-4">
            {activeQuote.items.map(item => (
              <QuoteItem
                key={item.id}
                item={item}
                quoteId={activeQuote.id}
                maskName={getMaskName(item.maskId)}
              />
            ))}
          </div>

          {/* Add Masks to Quote */}
          {getAvailableMasks().length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-medium text-gray-600 mb-2">Add Masks to Quote</h5>
              <div className="space-y-1">
                {getAvailableMasks().map(mask => (
                  <button
                    key={mask.id}
                    onClick={() => handleAddMaskToQuote(mask.id)}
                    className="w-full text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded transition-colors"
                  >
                    {mask.name || `Mask ${Object.keys(masks).indexOf(mask.id) + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quote Totals */}
          <div className="border-t border-gray-200 pt-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${activeQuote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Tax ({activeQuote.taxRate}%):</span>
                <span className="font-medium">${activeQuote.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1">
                <span>Total:</span>
                <span className="text-green-600">${activeQuote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <FileText size={32} className="mx-auto text-gray-400 mb-2" />
          <div className="text-sm text-gray-500 mb-2">No quote selected</div>
          <div className="text-xs text-gray-400">
            Create a new quote to get started
          </div>
        </div>
      )}

      {/* Share Modal */}
      {activeQuote && (
        <QuoteShareModal
          quote={activeQuote}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Settings Modal */}
      <QuoteSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
