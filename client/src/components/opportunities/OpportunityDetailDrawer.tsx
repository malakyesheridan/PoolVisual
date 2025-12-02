import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Tag
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
  stages: Array<{ id: string; name: string }>;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedValue, setEditedValue] = useState('');
  const [editedStatus, setEditedStatus] = useState<'open' | 'won' | 'lost' | 'abandoned'>('open');
  const [editedStageId, setEditedStageId] = useState<string>('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  
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

  useEffect(() => {
    if (opportunity) {
      setEditedTitle(opportunity.title || '');
      setEditedValue(opportunity.value?.toString() || '');
      setEditedStatus(opportunity.status || 'open');
      setEditedStageId(opportunity.stageId || '');
      setEditedTags(opportunity.tags || []);
      setIsEditing(isNewOpportunity);
    } else {
      setEditedTitle('');
      setEditedValue('');
      setEditedStatus('open');
      setEditedStageId('');
      setEditedTags([]);
      setIsEditing(false);
    }
  }, [opportunity?.id, isNewOpportunity]);

  // REBUILT: Save to backend FIRST, then notify parent to refetch
  const createOpportunityMutation = useMutation({
    mutationFn: async (data: any) => {
      // Save to backend - wait for response
      const created = await apiClient.createOpportunity(data);
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
      
      const defaultStage = stages[0];
      createOpportunityMutation.mutate({
        title: editedTitle.trim(),
        clientName: editedTitle.trim(),
        value: editedValue ? parseFloat(editedValue.replace(/[,$]/g, '')) : null,
        status: editedStatus,
        stageId: editedStageId || defaultStage?.id,
        pipelineStage: defaultStage?.name || 'new',
        tags: editedTags,
      });
    } else {
      updateOpportunityMutation.mutate({
        title: editedTitle,
        value: editedValue ? parseFloat(editedValue.replace(/[,$]/g, '')) : null,
        status: editedStatus,
        stageId: editedStageId,
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">
              {isNewOpportunity ? 'New Opportunity' : 'Opportunity Details'}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Header Section */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-bold mb-2 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                />
              ) : (
                <h2 className="text-xl font-bold mb-2">{opportunity?.title || 'Untitled Opportunity'}</h2>
              )}
              
              {!isNewOpportunity && opportunity?.contactName && (
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{opportunity.contactName}</span>
                </div>
              )}

              {!isNewOpportunity && (
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  {opportunity?.contactPhone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {opportunity.contactPhone}
                    </div>
                  )}
                  {opportunity?.contactEmail && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {opportunity.contactEmail}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={createOpportunityMutation.isPending || updateOpportunityMutation.isPending}>
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Value</Label>
              {isEditing ? (
                <Input
                  type="text"
                  value={editedValue}
                  onChange={(e) => handleValueChange(e.target.value)}
                  onBlur={handleValueBlur}
                  placeholder="0.00"
                  className="mt-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                />
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-4 h-4" />
                  {!isNewOpportunity && opportunity?.value 
                    ? formatCurrency(typeof opportunity.value === 'string' ? parseFloat(opportunity.value) : opportunity.value)
                    : isEditing ? (editedValue ? formatCurrency(parseFloat(editedValue.replace(/[,$]/g, ''))) : 'Not set') : 'Not set'}
                </div>
              )}
            </div>

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
                <Badge className={`mt-1 ${
                  editedStatus === 'won' ? 'bg-green-100 text-green-700' :
                  editedStatus === 'lost' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {editedStatus}
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
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-1">
                  {isEditing 
                    ? (stages.find(s => s.id === editedStageId)?.name || 'Not assigned')
                    : (opportunity?.stageName || 'Not assigned')
                  }
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
                    <Button onClick={handleAddTag} size="sm">
                      <Plus className="w-4 h-4" />
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
                  {editedTags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                  {editedTags.length === 0 && (
                    <span className="text-slate-400 text-sm">No tags</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Checklist Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Checklist</h3>
              <Badge variant="secondary">
                {pendingTasksList.length} pending, {completedTasksList.length} completed
              </Badge>
            </div>

            {opportunity?.id && (
              <div className="flex gap-2 mb-4">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="Add a checklist item..."
                  className="flex-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                />
                <Button onClick={handleAddTask} disabled={!newTaskTitle.trim() || createTaskMutation.isPending}>
                  <Plus className="w-4 h-4" />
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
              <div className="space-y-2 mt-4 pt-4 border-t-2 border-slate-200">
                <h4 className="text-sm font-medium text-slate-500 mb-3">Completed ({completedTasksList.length})</h4>
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

            {tasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border-2 border-slate-200">
                {opportunity?.id ? 'No checklist items yet. Add your first item above.' : 'Save the opportunity to add checklist items.'}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Notes</h3>
              <Badge variant="secondary">{notes.length}</Badge>
            </div>

            {opportunity?.id && (
              <div className="flex gap-2 mb-4">
                <Textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white resize-none"
                  rows={3}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim() || createNoteMutation.isPending}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border-2 border-slate-200">
                  {opportunity?.id ? 'No notes yet. Add your first note above.' : 'Save the opportunity to add notes.'}
                </div>
              ) : (
                notes.map((note: any) => {
                  const isEditing = editingNoteId === note.id;
                  
                  return (
                    <div key={note.id} className="p-4 bg-white rounded-lg border-2 border-slate-200 hover:border-slate-300 transition-colors shadow-sm group">
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
                          <div className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                            {note.noteText}
                          </div>
                          <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

