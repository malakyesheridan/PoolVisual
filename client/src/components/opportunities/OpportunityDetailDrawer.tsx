import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';
import { useLocation } from 'wouter';
import { useIsRealEstate } from '@/hooks/useIsRealEstate';
import { useJobsRoute } from '@/lib/route-utils';
import { 
  X, 
  Phone, 
  Mail, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Plus,
  Trash2,
  Edit,
  User,
  Tag,
  MapPin,
  FileText,
  ChevronDown,
  Eye
} from 'lucide-react';
import { formatCurrency } from '@/lib/measurement-utils';
import { format } from 'date-fns';

interface Opportunity {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  value?: number | string;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  stageId?: string;
  stageName?: string;
  ownerId?: string;
  ownerName?: string;
  tags?: string[];
  notes?: string;
  propertyJobId?: string;
  propertyName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  completedAt?: string;
  completedBy?: string;
  isRecurring?: boolean;
}

interface OpportunityDetailDrawerProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  stages: Array<{ id: string; name: string; color?: string }>;
  onOpportunityUpdated: () => void;
  onOpportunityCreated?: (opportunity: Opportunity) => void;
}

export function OpportunityDetailDrawer({
  opportunity,
  isOpen,
  onClose,
  stages,
  onOpportunityUpdated,
  onOpportunityCreated,
}: OpportunityDetailDrawerProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isRealEstate = useIsRealEstate();
  const jobsRoute = useJobsRoute();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedValue, setEditedValue] = useState('');
  const [editedStatus, setEditedStatus] = useState<'open' | 'won' | 'lost' | 'abandoned'>('open');
  const [editedStageId, setEditedStageId] = useState<string>('');
  const [editedPropertyJobId, setEditedPropertyJobId] = useState<string>('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Editing states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const isNewOpportunity = !opportunity?.id;

  // Fetch tasks and notes only if opportunity exists
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['/api/opportunities', opportunity?.id, 'tasks'],
    queryFn: () => apiClient.getOpportunityTasks(opportunity!.id),
    enabled: !!opportunity?.id,
    staleTime: 10 * 1000, // 10 seconds
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['/api/opportunities', opportunity?.id, 'notes'],
    queryFn: () => apiClient.getOpportunityNotes(opportunity!.id),
    enabled: !!opportunity?.id,
    staleTime: 10 * 1000,
  });

  // Fetch jobs/properties for property dropdown
  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: () => apiClient.getJobs(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (opportunity) {
      setEditedTitle(opportunity.title || '');
      setEditedValue(opportunity.value?.toString() || '');
      setEditedStatus(opportunity.status || 'open');
      setEditedStageId(opportunity.stageId || '');
      setEditedPropertyJobId(opportunity.propertyJobId || '');
      setEditedTags(opportunity.tags || []);
      setIsEditing(isNewOpportunity);
    } else {
      setEditedTitle('');
      setEditedValue('');
      setEditedStatus('open');
      setEditedStageId('');
      setEditedPropertyJobId('');
      setEditedTags([]);
      setIsEditing(false);
    }
  }, [opportunity?.id, isNewOpportunity]);

  // REBUILT: Save to backend FIRST, verify it was saved, then notify parent
  const createOpportunityMutation = useMutation({
    mutationFn: async (data: any) => {
      // Save to backend - wait for response
      const created = await apiClient.createOpportunity(data);
      
      // CRITICAL: Verify the opportunity was actually saved by fetching it back
      if (created?.id) {
        // Wait a moment for DB commit
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify by fetching it back
        try {
          const verified = await apiClient.getOpportunity(created.id);
          if (!verified) {
            throw new Error('Opportunity was not found after creation');
          }
          return verified;
        } catch (error) {
          // If verification fails, still return the created opportunity
          // The parent will handle refetching
          return created;
        }
      }
      
      return created;
    },
    onSuccess: async (createdOpportunity) => {
      if (!createdOpportunity?.id) {
        toast({
          title: 'Error',
          description: 'Failed to create opportunity - no ID returned',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Opportunity created', description: 'New opportunity created successfully.' });
      
      // Notify parent to refetch from backend
      if (onOpportunityCreated) {
        await onOpportunityCreated(createdOpportunity);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create opportunity',
        variant: 'destructive',
      });
    },
  });

  // REBUILT: Save to backend FIRST, then notify parent to refetch
  const updateOpportunityMutation = useMutation({
    mutationFn: (updates: Partial<Opportunity>) => 
      apiClient.updateOpportunity(opportunity!.id, updates),
    onSuccess: async () => {
      toast({ title: 'Opportunity updated', description: 'Changes saved successfully.' });
      setIsEditing(false);
      // Notify parent to refetch from backend
      await onOpportunityUpdated();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update opportunity',
        variant: 'destructive',
      });
    },
  });

  // Delete opportunity mutation
  const deleteOpportunityMutation = useMutation({
    mutationFn: () => apiClient.deleteOpportunity(opportunity!.id),
    onSuccess: async () => {
      toast({ title: 'Opportunity deleted', description: 'Opportunity has been deleted successfully.' });
      onClose();
      // Notify parent to refetch from backend
      await onOpportunityUpdated();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete opportunity',
        variant: 'destructive',
      });
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (isNewOpportunity) {
      onClose();
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteOpportunityMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const handleSave = () => {
    if (isNewOpportunity) {
      if (!editedTitle.trim()) {
        toast({
          title: 'Error',
          description: 'Title is required',
          variant: 'destructive',
        });
        return;
      }
      
      // CRITICAL: Always assign a stageId - use editedStageId or default to first stage
      // This ensures opportunities are always properly assigned and visible
      const defaultStage = stages.find(s => s.id === editedStageId) || stages[0];
      const finalStageId = editedStageId || defaultStage?.id;
      
      if (!finalStageId) {
        toast({
          title: 'Error',
          description: 'Please wait for stages to load before creating an opportunity',
          variant: 'destructive',
        });
        return;
      }
      
      // Ensure stageId is always set - this is critical for proper display
      createOpportunityMutation.mutate({
        title: editedTitle.trim(),
        clientName: editedTitle.trim(),
        value: editedValue ? parseFloat(editedValue.replace(/[,$]/g, '')) : null,
        status: editedStatus,
        stageId: finalStageId, // ALWAYS set stageId
        pipelineStage: defaultStage?.name || 'new',
        propertyJobId: editedPropertyJobId || null,
        tags: editedTags,
      });
    } else {
      updateOpportunityMutation.mutate({
        title: editedTitle,
        value: editedValue ? parseFloat(editedValue.replace(/[,$]/g, '')) : null,
        status: editedStatus,
        stageId: editedStageId,
        propertyJobId: editedPropertyJobId || null,
        tags: editedTags,
      });
    }
  };

  // REBUILT: Save to backend FIRST, then refetch
  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string }) => {
      if (!opportunity?.id) {
        throw new Error('Opportunity ID is required');
      }
      return apiClient.createOpportunityTask(opportunity.id, data);
    },
    onSuccess: async () => {
      setNewTaskTitle('');
      await refetchTasks();
      toast({ title: 'Task created', description: 'New task added successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task',
        variant: 'destructive',
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      return apiClient.updateOpportunityTask(taskId, updates);
    },
    onSuccess: async () => {
      await refetchTasks();
      toast({ title: 'Task updated', description: 'Task status updated.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => {
      return apiClient.deleteOpportunityTask(taskId);
    },
    onSuccess: async () => {
      await refetchTasks();
      toast({ title: 'Task deleted', description: 'Task removed successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete task',
        variant: 'destructive',
      });
    },
  });

  // REBUILT: Save to backend FIRST, then refetch
  const createNoteMutation = useMutation({
    mutationFn: (noteText: string) => {
      if (!opportunity?.id) {
        throw new Error('Opportunity ID is required');
      }
      return apiClient.createOpportunityNote(opportunity.id, noteText);
    },
    onSuccess: async () => {
      setNewNoteText('');
      await refetchNotes();
      toast({ title: 'Note added', description: 'Note saved successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add note',
        variant: 'destructive',
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      return apiClient.updateOpportunityNote(noteId, noteText);
    },
    onSuccess: async () => {
      await refetchNotes();
      toast({ title: 'Note updated', description: 'Note saved successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update note',
        variant: 'destructive',
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => {
      return apiClient.deleteOpportunityNote(noteId);
    },
    onSuccess: async () => {
      await refetchNotes();
      toast({ title: 'Note deleted', description: 'Note removed successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete note',
        variant: 'destructive',
      });
    },
  });

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    if (!opportunity?.id) {
      toast({
        title: 'Error',
        description: 'Please save the opportunity first',
        variant: 'destructive',
      });
      return;
    }
    createNoteMutation.mutate(newNoteText.trim());
  };

  const handleAddTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditedTags(editedTags.filter(t => t !== tag));
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    if (!opportunity?.id) {
      toast({
        title: 'Error',
        description: 'Please save the opportunity first',
        variant: 'destructive',
      });
      return;
    }
    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
    });
  };

  const handleToggleTask = (task: Task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    const updates: any = {
      status: newStatus,
    };
    
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
      updates.completedBy = user?.id;
    } else {
      updates.completedAt = null;
      updates.completedBy = null;
    }
    
    updateTaskMutation.mutate({
      taskId: task.id,
      updates,
    });
  };

  const handleSaveTaskEdit = (task: Task) => {
    if (!editingTaskTitle.trim()) return;
    updateTaskMutation.mutate({
      taskId: task.id,
      updates: { title: editingTaskTitle.trim() },
    });
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const handleDeleteTask = (task: Task) => {
    deleteTaskMutation.mutate(task.id);
  };

  const handleSaveNoteEdit = (note: any) => {
    if (!editingNoteText.trim()) return;
    updateNoteMutation.mutate({
      noteId: note.id,
      noteText: editingNoteText.trim(),
    });
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = (note: any) => {
    deleteNoteMutation.mutate(note.id);
  };

  const pendingTasksList = tasks.filter(t => t.status === 'pending');
  const completedTasksList = tasks.filter(t => t.status === 'completed');

  // Format currency input
  const formatCurrencyInput = (value: string) => {
    const num = value.replace(/[^0-9.]/g, '');
    if (!num) return '';
    const formatted = parseFloat(num).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return formatted;
  };

  const handleValueChange = (value: string) => {
    setEditedValue(value);
  };

  const handleValueBlur = () => {
    if (editedValue) {
      setEditedValue(formatCurrencyInput(editedValue));
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              {isNewOpportunity ? 'New Opportunity' : 'Opportunity Details'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!isNewOpportunity && !isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              {isEditing && (
                <>
                  <Button 
                    onClick={handleSave} 
                    disabled={createOpportunityMutation.isPending || updateOpportunityMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              )}
              {!isNewOpportunity && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Title Section */}
          <div>
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-bold border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
              />
            ) : (
              <h2 className="text-2xl font-bold">{opportunity?.title || 'Untitled Opportunity'}</h2>
            )}
          </div>

          {/* Contact Information Card */}
          {!isNewOpportunity && (
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                {opportunity?.contactName ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-900">{opportunity.contactName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 ml-6">
                      {opportunity.contactPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {opportunity.contactPhone}
                        </div>
                      )}
                      {opportunity.contactEmail && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {opportunity.contactEmail}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-slate-500">No contact assigned</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Financial Information Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium text-slate-700">Value</Label>
                {isEditing ? (
                  <Input
                    type="text"
                    value={editedValue}
                    onChange={(e) => handleValueChange(e.target.value)}
                    onBlur={handleValueBlur}
                    placeholder="0.00"
                    className="mt-1 text-lg font-semibold border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                  />
                ) : (
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {opportunity?.value 
                      ? formatCurrency(typeof opportunity.value === 'string' ? parseFloat(opportunity.value) : opportunity.value)
                      : 'Not set'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status & Pipeline Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Status & Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  {isEditing ? (
                    <Select value={editedStatus} onValueChange={(v: any) => setEditedStatus(v)}>
                      <SelectTrigger className="mt-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={`mt-1 px-3 py-1 ${
                      editedStatus === 'won' ? 'bg-emerald-500 text-white' :
                      editedStatus === 'lost' ? 'bg-red-500 text-white' :
                      editedStatus === 'abandoned' ? 'bg-gray-500 text-white' :
                      'bg-blue-500 text-white'
                    }`}>
                      {editedStatus.charAt(0).toUpperCase() + editedStatus.slice(1)}
                    </Badge>
                  )}
                </div>

                <div>
                  <Label>Stage</Label>
                  {isEditing ? (
                    <Select value={editedStageId} onValueChange={setEditedStageId}>
                      <SelectTrigger className="mt-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map(stage => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              {stage.color && (
                                <div 
                                  className="w-2 h-2 rounded-full border border-white shadow-sm" 
                                  style={{ backgroundColor: stage.color }}
                                />
                              )}
                              {stage.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1 flex items-center gap-2">
                      {opportunity?.stageId && stages.find(s => s.id === opportunity.stageId)?.color && (
                        <div 
                          className="w-3 h-3 rounded-full border-2 border-white shadow-sm" 
                          style={{ backgroundColor: stages.find(s => s.id === opportunity.stageId)?.color }}
                        />
                      )}
                      <span className="font-medium">{opportunity?.stageName || 'Not assigned'}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relationship Information Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Relationship
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Property</Label>
                  {isEditing ? (
                    <Select 
                      value={editedPropertyJobId || "__none__"} 
                      onValueChange={(value) => setEditedPropertyJobId(value === "__none__" ? "" : value)}
                    >
                      <SelectTrigger className="mt-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white">
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No property linked</SelectItem>
                        {jobs.map(job => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.clientName || job.address || `Property ${job.id.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1">
                      {opportunity?.propertyJobId ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">
                            {jobs.find(j => j.id === opportunity.propertyJobId)?.clientName || 
                             jobs.find(j => j.id === opportunity.propertyJobId)?.address || 
                             'Linked property'}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`${jobsRoute}/${opportunity.propertyJobId}`)}
                            className="ml-2"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-slate-400">Not linked</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Tags</Label>
                  {isEditing ? (
                    <div className="mt-1">
                      <div className="flex gap-2 mb-2">
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="Add tag"
                          className="flex-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                        />
                        <Button onClick={handleAddTag} size="default">
                          <Plus className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {editedTags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)}>
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {editedTags.length > 0 ? (
                        editedTags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary">{tag}</Badge>
                        ))
                      ) : (
                        <span className="text-slate-400 text-sm">No tags</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          {!isNewOpportunity && (opportunity?.contactEmail || opportunity?.contactPhone || opportunity?.propertyJobId) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {opportunity?.contactEmail && (
                    <Button variant="outline" className="justify-start">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email
                    </Button>
                  )}
                  {opportunity?.contactPhone && (
                    <Button variant="outline" className="justify-start">
                      <Phone className="w-4 h-4 mr-2" />
                      Schedule Call
                    </Button>
                  )}
                  {opportunity?.propertyJobId && (
                    <Button 
                      variant="outline" 
                      className="justify-start"
                      onClick={() => navigate(`/jobs/${opportunity.propertyJobId}`)}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      View Property
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Checklist
                </div>
                <Badge variant="secondary">
                  {pendingTasksList.length} pending, {completedTasksList.length} completed
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {opportunity?.id && (
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="Add a checklist item..."
                    className="flex-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                  />
                  <Button 
                    onClick={handleAddTask} 
                    disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                    size="default"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              )}

            {pendingTasksList.length > 0 && (
              <div className="space-y-2 mb-4">
                {pendingTasksList.map((task) => {
                  const isEditing = editingTaskId === task.id;
                  
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-white hover:bg-slate-50 rounded-lg transition-colors border-2 border-slate-200 shadow-sm group">
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        onChange={() => handleToggleTask(task)}
                        className="w-5 h-5 mt-0.5 cursor-pointer accent-primary border-2 border-slate-300 rounded"
                        disabled={updateTaskMutation.isPending || isEditing}
                      />
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingTaskTitle}
                              onChange={(e) => setEditingTaskTitle(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTaskEdit(task);
                                } else if (e.key === 'Escape') {
                                  setEditingTaskId(null);
                                  setEditingTaskTitle('');
                                }
                              }}
                              className="flex-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                              autoFocus
                            />
                            <Button size="sm" onClick={() => handleSaveTaskEdit(task)}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingTaskId(null);
                              setEditingTaskTitle('');
                            }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="font-medium text-slate-900">{task.title}</div>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setEditingTaskTitle(task.title);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTask(task)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

              {completedTasksList.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-3 w-full text-left"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
                    Completed ({completedTasksList.length})
                  </button>
                  {showCompleted && (
                    <div className="space-y-2">
                      {completedTasksList.map((task) => {
                  const isEditing = editingTaskId === task.id;
                  
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg transition-colors border-2 border-emerald-200 shadow-sm group">
                      <input
                        type="checkbox"
                        checked={task.status === 'completed'}
                        onChange={() => handleToggleTask(task)}
                        className="w-5 h-5 mt-0.5 cursor-pointer accent-emerald-600 border-2 border-emerald-300 rounded"
                        disabled={updateTaskMutation.isPending || isEditing}
                      />
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingTaskTitle}
                              onChange={(e) => setEditingTaskTitle(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTaskEdit(task);
                                } else if (e.key === 'Escape') {
                                  setEditingTaskId(null);
                                  setEditingTaskTitle('');
                                }
                              }}
                              className="flex-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                              autoFocus
                            />
                            <Button size="sm" onClick={() => handleSaveTaskEdit(task)}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingTaskId(null);
                              setEditingTaskTitle('');
                            }}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="font-medium text-slate-700 line-through">{task.title}</div>
                        )}
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setEditingTaskTitle(task.title);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTask(task)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                      })}
                    </div>
                  )}
                </div>
              )}

              {pendingTasksList.length === 0 && completedTasksList.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-4">
                    {opportunity?.id ? 'No checklist items yet' : 'Save the opportunity to add checklist items'}
                  </p>
                  {opportunity?.id && (
                    <Button variant="outline" size="sm" onClick={() => {/* focus input */}}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add first item
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card className="bg-amber-50/30 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-700" />
                  Notes
                </div>
                <Badge variant="secondary">{notes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {opportunity?.id && (
                <div className="flex gap-2 mb-4">
                  <Textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 min-h-[80px] border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white resize-none"
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim() || createNoteMutation.isPending}
                    size="default"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
              )}

              {notes.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 mb-4">
                    {opportunity?.id ? 'No notes yet' : 'Save the opportunity to add notes'}
                  </p>
                  {opportunity?.id && (
                    <Button variant="outline" size="sm" onClick={() => {/* focus textarea */}}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add first note
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note: any) => {
                    const isEditing = editingNoteId === note.id;
                    
                    return (
                      <Card key={note.id} className="bg-white group">
                        <CardContent className="p-4">
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white resize-none"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSaveNoteEdit(note)}>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteText('');
                                }}>
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap mb-2">
                                {note.noteText}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center justify-between">
                                <span>{format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingNoteText(note.noteText);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteNote(note)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Opportunity</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete "{opportunity?.title || 'this opportunity'}"? This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={confirmDelete}
            disabled={deleteOpportunityMutation.isPending}
          >
            {deleteOpportunityMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

