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
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

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

  useEffect(() => {
    if (opportunity) {
      setEditedTitle(opportunity.title || '');
      setEditedValue(opportunity.value?.toString() || '');
      setEditedStatus(opportunity.status || 'open');
      setEditedStageId(opportunity.stageId || '');
      setEditedTags(opportunity.tags || []);
      setIsEditing(false);
    }
  }, [opportunity]);

  const updateOpportunityMutation = useMutation({
    mutationFn: (updates: Partial<Opportunity>) => 
      apiClient.updateOpportunity(opportunity!.id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opportunities'] });
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

  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string; dueDate?: string }) =>
      apiClient.createOpportunityTask(opportunity!.id, data),
    onSuccess: () => {
      refetchTasks();
      setNewTaskTitle('');
      setNewTaskDueDate('');
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
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) =>
      apiClient.updateOpportunityTask(taskId, updates),
    onSuccess: () => {
      refetchTasks();
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
    mutationFn: (noteText: string) =>
      apiClient.createOpportunityNote(opportunity!.id, noteText),
    onSuccess: () => {
      refetchNotes();
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

  const handleSave = () => {
    updateOpportunityMutation.mutate({
      title: editedTitle,
      value: editedValue ? parseFloat(editedValue) : undefined,
      status: editedStatus,
      stageId: editedStageId || undefined,
      tags: editedTags,
    });
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
    if (newTaskTitle.trim()) {
      createTaskMutation.mutate({
        title: newTaskTitle.trim(),
        dueDate: newTaskDueDate || undefined,
      });
    }
  };

  const handleToggleTask = (task: Task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    updateTaskMutation.mutate({
      taskId: task.id,
      updates: {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
        completedBy: newStatus === 'completed' ? user?.id : undefined,
      },
    });
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (!opportunity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Opportunity Details</DialogTitle>
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
                  className="text-xl font-bold mb-2"
                />
              ) : (
                <h2 className="text-xl font-bold mb-2">{opportunity.title}</h2>
              )}
              
              {opportunity.contactName && (
                <div className="flex items-center gap-2 text-slate-600 mb-2">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{opportunity.contactName}</span>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-500">
                {opportunity.contactPhone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {opportunity.contactPhone}
                  </div>
                )}
                {opportunity.contactEmail && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {opportunity.contactEmail}
                  </div>
                )}
              </div>
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
                  className="mt-1"
                />
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <DollarSign className="w-4 h-4" />
                  {opportunity.value 
                    ? formatCurrency(typeof opportunity.value === 'string' ? parseFloat(opportunity.value) : opportunity.value)
                    : 'Not set'}
                </div>
              )}
            </div>

            <div>
              <Label>Status</Label>
              {isEditing ? (
                <Select value={editedStatus} onValueChange={(v: any) => setEditedStatus(v)}>
                  <SelectTrigger className="mt-1">
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
                  opportunity.status === 'won' ? 'bg-green-100 text-green-700' :
                  opportunity.status === 'lost' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {opportunity.status}
                </Badge>
              )}
            </div>

            <div>
              <Label>Stage</Label>
              {isEditing ? (
                <Select value={editedStageId} onValueChange={setEditedStageId}>
                  <SelectTrigger className="mt-1">
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
                <div className="mt-1">{opportunity.stageName || 'Not assigned'}</div>
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
                      className="flex-1"
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
                  {opportunity.tags?.map((tag, idx) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                  {(!opportunity.tags || opportunity.tags.length === 0) && (
                    <span className="text-slate-400 text-sm">No tags</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Tasks</h3>
              <Badge variant="secondary">
                {pendingTasks.length} pending, {completedTasks.length} completed
              </Badge>
            </div>

            {/* Add new task */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="Add a new task..."
                className="flex-1"
              />
              <Input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleAddTask} disabled={!newTaskTitle.trim() || createTaskMutation.isPending}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Pending tasks */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2 mb-4">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => handleToggleTask(task)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-slate-500">{task.description}</div>
                      )}
                      {task.dueDate && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-500">Completed</h4>
                {completedTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg opacity-60">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => handleToggleTask(task)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 line-through">
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-slate-500">{task.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                No tasks yet. Add your first task above.
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Notes</h3>
              <Badge variant="secondary">{notes.length}</Badge>
            </div>

            {/* Add new note */}
            <div className="flex gap-2 mb-4">
              <Textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Add a note..."
                className="flex-1"
                rows={3}
              />
              <Button 
                onClick={() => {
                  if (newNoteText.trim()) {
                    createNoteMutation.mutate(newNoteText.trim());
                    setNewNoteText('');
                  }
                }}
                disabled={!newNoteText.trim() || createNoteMutation.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {notes.map((note: any) => (
                <div key={note.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-sm">{note.noteText}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <div className="text-center py-4 text-slate-400 text-sm">
                  No notes yet. Add your first note above.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

