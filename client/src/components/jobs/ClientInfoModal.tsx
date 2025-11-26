/**
 * Client Info Modal Component
 * 
 * Displays client information in a beautiful modal dialog
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { User, Phone, Mail, MapPin, Calendar, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ClientInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    clientName: string;
    clientPhone?: string | null;
    clientEmail?: string | null;
    address?: string | null;
    status?: string;
    createdAt: string;
  };
}

export function ClientInfoModal({ isOpen, onClose, job }: ClientInfoModalProps) {
  const hasContactInfo = job.clientPhone || job.clientEmail || job.address;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl text-slate-900">
                Client Information
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Job #{job.id.substring(0, 8)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Client Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <User className="w-4 h-4 text-slate-500" />
              Client Name
            </div>
            <p className="text-base font-semibold text-slate-900 pl-6">
              {job.clientName}
            </p>
          </div>

          {/* Contact Information */}
          {hasContactInfo && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {job.clientPhone && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Phone className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Phone Number</p>
                    <a
                      href={`tel:${job.clientPhone}`}
                      className="text-sm text-primary hover:text-primary hover:underline break-all"
                    >
                      {job.clientPhone}
                    </a>
                  </div>
                </div>
              )}

              {job.clientEmail && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Email Address</p>
                    <a
                      href={`mailto:${job.clientEmail}`}
                      className="text-sm text-primary hover:text-primary hover:underline break-all"
                    >
                      {job.clientEmail}
                    </a>
                  </div>
                </div>
              )}

              {job.address && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Property Address</p>
                    <p className="text-sm text-slate-900 break-words">
                      {job.address}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Job Metadata */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
            </div>
            {job.status && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <Badge 
                  variant="outline" 
                  className="text-xs border-slate-200"
                >
                  {job.status}
                </Badge>
              </div>
            )}
          </div>

          {/* Empty State for Missing Contact Info */}
          {!hasContactInfo && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm text-slate-500 italic text-center py-2">
                No additional contact information available
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

