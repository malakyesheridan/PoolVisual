/**
 * PDF Preview Component
 * 
 * Displays PDF preview in a modal with download functionality
 * Uses react-pdf for client-side rendering (like Canva)
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const { toast } = useToast();

  const loadPDF = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get PDF as blob for preview (with preview flag for inline display)
      const blob = await apiClient.generateQuotePDF(quoteId, {
        watermark: true, // Preview has watermark
        terms: true,
        preview: true // Request inline display
      });
      
      // Validate blob
      if (!blob || blob.size === 0) {
        throw new Error('Received empty PDF blob');
      }

      // Check if it's actually a PDF
      const blobStart = await blob.slice(0, 4).text();
      if (!blobStart.startsWith('%PDF')) {
        throw new Error('Received file is not a valid PDF');
      }
      
      // Create blob URL for preview
      const blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
      setPageNumber(1); // Reset to first page
    } catch (error: any) {
      console.error('[PDFPreview] Error loading PDF:', error);
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
      setIsLoading(true);
      
      // Get PDF for download (no preview flag = attachment)
      const blob = await apiClient.generateQuotePDF(quoteId, {
        watermark: false,
        terms: true,
        preview: false // Force download
      });
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty PDF blob');
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `quote-${quoteId.substring(0, 8)}.pdf`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setIsLoading(false);
      }, 100);
      
      toast({
        title: "PDF Downloaded",
        description: "Quote PDF has been downloaded successfully",
      });
    } catch (error: any) {
      console.error('[PDFPreview] Error downloading PDF:', error);
      setIsLoading(false);
      toast({
        title: "Error downloading PDF",
        description: error.message || "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('[PDFPreview] Document load error:', error);
    setError(`Failed to load PDF: ${error.message}`);
    toast({
      title: "Error loading PDF",
      description: error.message,
      variant: "destructive",
    });
  };

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => {
      if (numPages) {
        return Math.min(numPages, prev + 1);
      }
      return prev;
    });
  };

  const zoomIn = () => {
    setScale(prev => Math.min(3.0, prev + 0.25));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.25));
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
      setPageNumber(1);
      setScale(1.0);
      setNumPages(null);
    }
  }, [isOpen, quoteId]);

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
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
              disabled={isLoading}
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
        
        <div className="flex-1 overflow-hidden flex flex-col">
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
          ) : isLoading && !pdfBlobUrl ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-slate-600">Loading PDF preview...</p>
              </div>
            </div>
          ) : pdfBlobUrl ? (
            <div className="flex flex-col h-full">
              {/* PDF Controls */}
              <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={goToPrevPage}
                    disabled={pageNumber <= 1}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-slate-600">
                    Page {pageNumber} of {numPages || '?'}
                  </span>
                  <Button
                    onClick={goToNextPage}
                    disabled={!numPages || pageNumber >= numPages}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={zoomOut}
                    variant="outline"
                    size="sm"
                    disabled={scale <= 0.5}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-slate-600 min-w-[60px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <Button
                    onClick={zoomIn}
                    variant="outline"
                    size="sm"
                    disabled={scale >= 3.0}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
                <Document
                  file={pdfBlobUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center h-96">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading PDF...</p>
                      </div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    className="shadow-lg"
                  />
                </Document>
              </div>
            </div>
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
