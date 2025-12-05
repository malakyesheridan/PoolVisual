/**
 * Buyer Form Link Dialog
 * Modal for generating and sharing buyer inquiry form links
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Link as LinkIcon, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BuyerFormLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  propertyName?: string;
}

export function BuyerFormLinkDialog({
  open,
  onOpenChange,
  propertyId,
  propertyName,
}: BuyerFormLinkDialogProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const generateLinkMutation = useMutation({
    mutationFn: async (data: { propertyId?: string; expiresAt?: string }) => {
      return apiClient.createBuyerFormLink(data);
    },
    onSuccess: (data) => {
      setGeneratedLink(data.shareUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/buyer-forms'] });
      toast.success('Form link generated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate form link');
    },
  });

  const handleGenerate = () => {
    let expiresAt: string | undefined = undefined;
    
    if (expiresIn !== 'never') {
      const now = new Date();
      const days = parseInt(expiresIn);
      if (!isNaN(days)) {
        expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    generateLinkMutation.mutate({
      propertyId: propertyId || undefined,
      expiresAt,
    });
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setExpiresIn('never');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            {propertyId ? 'Share Buyer Form' : 'Create Buyer Form Link'}
          </DialogTitle>
          <DialogDescription>
            {propertyId
              ? `Generate a shareable link for buyers to inquire about ${propertyName || 'this property'}.`
              : 'Generate a shareable link for buyers to submit their requirements.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {propertyId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Property-specific form:</strong> This link will be tied to{' '}
                {propertyName || 'this property'}.
              </p>
            </div>
          )}

          {!generatedLink ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="expiresIn">Link Expiry (Optional)</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger id="expiresIn">
                    <SelectValue placeholder="Select expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">No expiry</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateLinkMutation.isPending}
                className="w-full"
              >
                {generateLinkMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Generate Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Your Form Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Share this link with buyers. They can submit their requirements without logging in.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button onClick={handleGenerate} variant="outline" className="flex-1">
                  Generate New Link
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

