import React, { useState } from 'react';
import { Quote } from '../../maskcore/store';
import { useMaskStore } from '../../maskcore/store';
import { X, Send, Mail } from 'lucide-react';

interface QuoteShareModalProps {
  quote: Quote;
  isOpen: boolean;
  onClose: () => void;
}

export function QuoteShareModal({ quote, isOpen, onClose }: QuoteShareModalProps) {
  const [email, setEmail] = useState(quote.clientEmail || '');
  const [subject, setSubject] = useState(`Quote: ${quote.name}`);
  const [message, setMessage] = useState(`Dear ${quote.clientName || 'Client'},

Please find attached your quote for the pool design project.

Quote Details:
- Quote Name: ${quote.name}
- Total Amount: $${quote.total.toFixed(2)}
- Items: ${quote.items.length} items included

This quote is valid for 30 days from the date issued.

Please let me know if you have any questions or would like to discuss any aspects of this quote.

Best regards,
Pool Design Pro`);
  
  const { UPDATE_QUOTE } = useMaskStore();
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      alert('Please enter an email address');
      return;
    }

    setIsSending(true);
    
    try {
      // Update quote with client email if provided
      if (email !== quote.clientEmail) {
        UPDATE_QUOTE(quote.id, { clientEmail: email });
      }
      
      // Create mailto link with pre-filled content
      const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      
      // Open email client
      window.open(mailtoLink, '_blank');
      
      // Update quote status
      UPDATE_QUOTE(quote.id, { 
        status: 'sent',
        sentAt: Date.now()
      });
      
      onClose();
    } catch (error) {
      console.error('Error sending quote:', error);
      alert('Error sending quote. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSend();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Share Quote</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="client@example.com"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              rows={8}
              placeholder="Enter your message..."
            />
          </div>

          <div className="text-xs text-gray-500">
            <p>• This will open your default email client</p>
            <p>• Quote status will be updated to "Sent"</p>
            <p>• Press Ctrl+Enter to send, Escape to cancel</p>
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
            onClick={handleSend}
            disabled={isSending || !email.trim()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Send size={16} />
            <span>{isSending ? 'Sending...' : 'Send Quote'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
