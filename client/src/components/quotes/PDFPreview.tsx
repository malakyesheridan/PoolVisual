/**
 * PDF Preview Component
 * 
 * Displays PDF preview in a modal with download functionality
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

interface PDFPreviewProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
  filename?: string;
}

export function PDFPreview({ quoteId, isOpen, onClose, filename }: PDFPreviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadPDF = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get PDF as blob for better browser compatibility
      // Preview uses watermark to indicate it's a preview
      const blob = await apiClient.generateQuotePDF(quoteId, {
        watermark: true, // Preview has watermark
        terms: true
      });
      
      // Create blob URL for preview
      const blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to load PDF preview";
      setError(errorMessage);
      
      toast({
        title: "Error loading PDF",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const blob = await apiClient.generateQuotePDF(quoteId, {
        watermark: false,
        terms: true
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `quote-${quoteId.substring(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Downloaded",
        description: "Quote PDF has been downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error downloading PDF",
        description: error.message || "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  // Load PDF when modal opens or quoteId changes
  useEffect(() => {
    if (isOpen) {
      loadPDF();
    } else {
      // Clear blob URL when modal closes
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      setError(null);
    }
  }, [isOpen, quoteId]);

  // Cleanup blob URL when component unmounts or blob URL changes
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quote Preview
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={downloadPDF}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <FileText className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 font-medium mb-2">Failed to load PDF</p>
                <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">{error}</p>
                <Button
                  onClick={loadPDF}
                  variant="outline"
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-slate-600">Loading PDF preview...</p>
              </div>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full min-h-[600px] border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No PDF data available</p>
                <Button
                  onClick={loadPDF}
                  variant="outline"
                  className="mt-4"
                >
                  Load PDF Preview
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
