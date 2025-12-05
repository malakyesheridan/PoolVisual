import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface FollowUpMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  smsText: string;
  emailSubject: string;
  emailBody: string;
}

export function FollowUpMessageDialog({
  isOpen,
  onClose,
  smsText,
  emailSubject,
  emailBody,
}: FollowUpMessageDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-Up Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* SMS Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">SMS Message</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(smsText, 'sms')}
              >
                {copiedField === 'sms' ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={smsText}
              readOnly
              className="min-h-[80px] font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              {smsText.length} characters
            </p>
          </div>

          {/* Email Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Email Subject</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(emailSubject, 'subject')}
              >
                {copiedField === 'subject' ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Input value={emailSubject} readOnly />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Email Body</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(emailBody, 'body')}
              >
                {copiedField === 'body' ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={emailBody}
              readOnly
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

