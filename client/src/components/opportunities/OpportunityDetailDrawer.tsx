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
  Calendar,
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
  onUpdate: () => void;
}

export function OpportunityDetailDrawer({
  opportunity,
  isOpen,
  onClose,
  stages,
  onUpdate,
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
  // Temporary storage for tasks and notes before opportunity is saved
  const [pendingTasks, setPendingTasks] = useState<Array<{ id: string; title: string; status: 'pending' | 'completed' }>>([]);
  const [pendingNotes, setPendingNotes] = useState<Array<{ id: string; noteText: string; createdAt: string }>>([]);
  // Editing states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Fetch tasks for this opportunity
  const { data: tasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['/api/opportunities', opportunity?.id, 'tasks'],
    queryFn: () => apiClient.getOpportunityTasks(opportunity!.id),
    enabled: !!opportunity?.id,
  });

  // Fetch notes for this opportunity
  const { data: notes = [], refetch: refetchNotes } = useQuery({
    queryKey: ['/api/opportunities', opportunity?.id, 'notes'],
    queryFn: () => apiClient.getOpportunityNotes(opportunity!.id),
    enabled: !!opportunity?.id,
  });

  const isNewOpportunity = !opportunity?.id;

  useEffect(() => {
    if (opportunity) {
      setEditedTitle(opportunity.title || '');
      setEditedValue(opportunity.value?.toString() || '');
      setEditedStatus(opportunity.status || 'open');
      setEditedStageId(opportunity.stageId || '');
      setEditedTags(opportunity.tags || []);
      setIsEditing(isNewOpportunity); // Auto-edit mode for new opportunities
    } else {
      // Reset form when drawer closes
      setEditedTitle('');
      setEditedValue('');
      setEditedStatus('open');
      setEditedStageId('');
      setEditedTags([]);
      setIsEditing(false);
    }
  }, [opportunity, isNewOpportunity]);

  const createOpportunityMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('[Frontend] Creating opportunity with data:', data);
      return apiClient.createOpportunity(data);
    },
    onSuccess: async (createdOpportunity) => {
      console.log('[Frontend] Opportunity created successfully:', createdOpportunity);
      
      if (createdOpportunity?.id) {
        // Save pending tasks and notes after opportunity is created
        for (const task of pendingTasks) {
          try {
            await apiClient.createOpportunityTask(createdOpportunity.id, { title: task.title });
          } catch (error) {
            console.error('Failed to save pending task:', error);
          }
        }
        
        for (const note of pendingNotes) {
          try {
            await apiClient.createOpportunityNote(createdOpportunity.id, note.noteText);
          } catch (error) {
            console.error('Failed to save pending note:', error);
          }
        }
        
        // Clear pending items
        setPendingTasks([]);
        setPendingNotes([]);
        
        // Optimistically update ALL opportunity queries (regardless of statusFilter)
        // This ensures the new opportunity appears immediately
        queryClient.setQueriesData(
          { queryKey: ['/api/opportunities'], exact: false },
          (oldData: any) => {
            if (!oldData || !Array.isArray(oldData)) return oldData;
            // Check if opportunity already exists (avoid duplicates)
            const exists = oldData.some((opp: any) => opp.id === createdOpportunity.id);
            if (exists) return oldData;
            // Add the new opportunity to the beginning of the array
            return [createdOpportunity, ...oldData];
          }
        );
      }
      
      // Invalidate all opportunity queries to trigger a background refetch
      // This ensures data consistency but doesn't block the UI
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'], exact: false });
      
      toast({ title: 'Opportunity created', description: 'New opportunity created successfully.' });
      
      // Notify parent component about the newly created opportunity
      if (onOpportunityCreated && createdOpportunity) {
        onOpportunityCreated(createdOpportunity);
      }
      
      // Update queries in the background
      onUpdate();
      
      // Don't close the drawer - let the user see and interact with the newly created opportunity
    },
    onError: (error: any) => {
      console.error('[Frontend] Error creating opportunity:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create opportunity',
        variant: 'destructive',
      });
    },
  });

  const updateOpportunityMutation = useMutation({
    mutationFn: (updates: Partial<Opportunity>) => 
      apiClient.updateOpportunity(opportunity!.id, updates),
    onSuccess: (updatedOpportunity) => {
      // Update local state with the returned opportunity data
      if (updatedOpportunity) {
        setEditedTags(Array.isArray(updatedOpportunity.tags) ? updatedOpportunity.tags : []);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities', opportunity?.id] });
      toast({ title: 'Opportunity updated', description: 'Changes saved successfully.' });
      setIsEditing(false);
      onUpdate();
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
      // Create new opportunity
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
        clientName: editedTitle.trim(), // Required field
        value: editedValue ? parseFloat(editedValue.replace(/,/g, '')) : null,
        status: editedStatus,
        stageId: editedStageId || defaultStage?.id,
        pipelineStage: defaultStage?.name || 'new',
        tags: editedTags,
      });
    } else {
      // Update existing opportunity
      updateOpportunityMutation.mutate({
        title: editedTitle,
        value: editedValue ? parseFloat(editedValue.replace(/,/g, '')) : null,
        status: editedStatus,
        stageId: editedStageId,
        tags: editedTags,
      });
    }
  };

  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string; dueDate?: string }) => {
      if (!opportunity?.id) {
        throw new Error('Opportunity ID is required');
      }
      return apiClient.createOpportunityTask(opportunity.id, data);
    },
    onSuccess: async () => {
      // Clear input immediately
      setNewTaskTitle('');
      // Refetch tasks
      await refetchTasks();
      // Also invalidate the query cache
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities', opportunity?.id, 'tasks'] });
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
      // Refetch tasks
      await refetchTasks();
      // Also invalidate the query cache
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities', opportunity?.id, 'tasks'] });
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

  const createNoteMutation = useMutation({
    mutationFn: (noteText: string) => {
      if (!opportunity?.id) {
        throw new Error('Opportunity ID is required');
      }
      return apiClient.createOpportunityNote(opportunity.id, noteText);
    },
    onSuccess: async () => {
      // Clear the input immediately
      setNewNoteText('');
      // Refetch notes
      await refetchNotes();
      // Also invalidate the query cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities', opportunity?.id, 'notes'] });
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

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    
    if (!opportunity?.id) {
      // Store temporarily if opportunity doesn't exist yet
      const tempNote = {
        id: `temp-${Date.now()}-${Math.random()}`,
        noteText: newNoteText.trim(),
        createdAt: new Date().toISOString(),
      };
      setPendingNotes([...pendingNotes, tempNote]);
      setNewNoteText('');
      toast({ title: 'Note added', description: 'Note will be saved when opportunity is created.' });
    } else {
      createNoteMutation.mutate(newNoteText.trim());
    }
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
      // Store temporarily if opportunity doesn't exist yet
      const tempTask = {
        id: `temp-${Date.now()}-${Math.random()}`,
        title: newTaskTitle.trim(),
        status: 'pending' as const,
      };
      setPendingTasks([...pendingTasks, tempTask]);
      setNewTaskTitle('');
      toast({ title: 'Task added', description: 'Task will be saved when opportunity is created.' });
    } else {
      createTaskMutation.mutate({
        title: newTaskTitle.trim(),
      });
    }
  };

  const handleToggleTask = (task: Task) => {
    const isTemp = task.id.startsWith('temp-');
    
    if (isTemp) {
      // Update temporary task
      setPendingTasks(pendingTasks.map(t => 
        t.id === task.id 
          ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' }
          : t
      ));
      return;
    }
    
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    const updates: any = {
      status: newStatus,
    };
    
    // Only set completedAt and completedBy when completing
    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
      updates.completedBy = user?.id;
    } else {
      // When uncompleting, clear these fields
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
    
    const isTemp = task.id.startsWith('temp-');
    
    if (isTemp) {
      // Update temporary task
      setPendingTasks(pendingTasks.map(t => 
        t.id === task.id ? { ...t, title: editingTaskTitle.trim() } : t
      ));
      setEditingTaskId(null);
      setEditingTaskTitle('');
      return;
    }
    
    updateTaskMutation.mutate({
      taskId: task.id,
      updates: { title: editingTaskTitle.trim() },
    });
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const handleDeleteTask = (task: Task) => {
    const isTemp = task.id.startsWith('temp-');
    
    if (isTemp) {
      // Remove temporary task
      setPendingTasks(pendingTasks.filter(t => t.id !== task.id));
      return;
    }
    
    deleteTaskMutation.mutate(task.id);
  };

  const handleSaveNoteEdit = (note: any) => {
    if (!editingNoteText.trim()) return;
    
    const isTemp = note.id.startsWith('temp-');
    
    if (isTemp) {
      // Update temporary note
      setPendingNotes(pendingNotes.map(n => 
        n.id === note.id ? { ...n, noteText: editingNoteText.trim() } : n
      ));
      setEditingNoteId(null);
      setEditingNoteText('');
      return;
    }
    
    updateNoteMutation.mutate({
      noteId: note.id,
      noteText: editingNoteText.trim(),
    });
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = (note: any) => {
    const isTemp = note.id.startsWith('temp-');
    
    if (isTemp) {
      // Remove temporary note
      setPendingNotes(pendingNotes.filter(n => n.id !== note.id));
      return;
    }
    
    deleteNoteMutation.mutate(note.id);
  };

  // Combine saved tasks with pending tasks
  const allTasks = [...tasks, ...pendingTasks];
  const pendingTasksList = allTasks.filter(t => t.status === 'pending');
  const completedTasksList = allTasks.filter(t => t.status === 'completed');
  
  // Combine saved notes with pending notes
  const allNotes = [...notes, ...pendingNotes];

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
                  <Button onClick={handleSave} disabled={updateOpportunityMutation.isPending}>
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
                  type="number"
                  value={editedValue}
                  onChange={(e) => setEditedValue(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 border-2 border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
                />
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-4 h-4" />
                  {!isNewOpportunity && opportunity?.value 
                    ? formatCurrency(typeof opportunity.value === 'string' ? parseFloat(opportunity.value) : opportunity.value)
                    : isEditing ? (editedValue ? formatCurrency(parseFloat(editedValue)) : 'Not set') : 'Not set'}
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

            {/* Add new checklist item */}
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

            {/* Pending checklist items */}
            {pendingTasksList.length > 0 && (
              <div className="space-y-2 mb-4">
                {pendingTasksList.map((task) => {
                  const isTemp = task.id.startsWith('temp-');
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
                        {task.description && !isEditing && (
                          <div className="text-sm text-slate-600 mt-1">{task.description}</div>
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

            {/* Completed checklist items */}
            {completedTasksList.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t-2 border-slate-200">
                <h4 className="text-sm font-medium text-slate-500 mb-3">Completed ({completedTasksList.length})</h4>
                {completedTasksList.map((task) => {
                  const isTemp = task.id.startsWith('temp-');
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
                        {task.description && !isEditing && (
                          <div className="text-sm text-slate-500 line-through mt-1">{task.description}</div>
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

            {/* Empty state - only show if there are no tasks at all */}
            {allTasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border-2 border-slate-200">
                No checklist items yet. Add your first item above.
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Notes</h3>
              <Badge variant="secondary">{allNotes.length}</Badge>
            </div>

            {/* Add new note */}
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

            <div className="space-y-3">
              {allNotes.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border-2 border-slate-200">
                  No notes yet. Add your first note above.
                </div>
              ) : (
                allNotes.map((note: any) => {
                  const isTemp = note.id.startsWith('temp-');
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
                            <div className="flex items-center gap-2">
                              <span>{format(new Date(note.createdAt), 'MMM d, yyyy')}</span>
                              <span>•</span>
                              <span>{format(new Date(note.createdAt), 'h:mm a')}</span>
                              {note.noteType && note.noteType !== 'general' && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    {note.noteType}
                                  </Badge>
                                </>
                              )}
                            </div>
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

