import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Save, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';

interface PropertyNotesProps {
  jobId: string;
}

export function PropertyNotes({ jobId }: PropertyNotesProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteText, setEditingNoteText] = useState('');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'notes'],
    queryFn: () => apiClient.getPropertyNotes(jobId),
    enabled: !!jobId,
  });

  const createNoteMutation = useMutation({
    mutationFn: (noteText: string) => apiClient.createPropertyNote(jobId, noteText, []),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      setNewNoteText('');
      toast({
        title: 'Note created',
        description: 'Property note has been added successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating note',
        description: error.message || 'Failed to create note.',
        variant: 'destructive',
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, noteText }: { noteId: string; noteText: string }) =>
      apiClient.updatePropertyNote(noteId, noteText, []),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      setEditingNoteId(null);
      setEditingNoteText('');
      toast({
        title: 'Note updated',
        description: 'Property note has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating note',
        description: error.message || 'Failed to update note.',
        variant: 'destructive',
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => apiClient.deletePropertyNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'notes'] });
      toast({
        title: 'Note deleted',
        description: 'Property note has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting note',
        description: error.message || 'Failed to delete note.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateNote = () => {
    if (!newNoteText.trim()) {
      toast({
        title: 'Invalid note',
        description: 'Note text cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    createNoteMutation.mutate(newNoteText.trim());
  };

  const handleStartEdit = (note: any) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.noteText);
  };

  const handleSaveEdit = (noteId: string) => {
    if (!editingNoteText.trim()) {
      toast({
        title: 'Invalid note',
        description: 'Note text cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    updateNoteMutation.mutate({ noteId, noteText: editingNoteText.trim() });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new note */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a note about this property..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleCreateNote}
              disabled={createNoteMutation.isPending || !newNoteText.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              {createNoteMutation.isPending ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </div>

        {/* Notes list */}
        {isLoading ? (
          <div className="text-sm text-slate-500">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-8">
            No notes yet. Add a note to track important information about this property.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note: any) => (
              <div
                key={note.id}
                className="border border-slate-200 rounded-lg p-4 space-y-2"
              >
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={updateNoteMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateNoteMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">
                      {note.noteText}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                        </span>
                        {note.userId === user?.id && (
                          <Badge variant="secondary" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(note)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this note?')) {
                              deleteNoteMutation.mutate(note.id);
                            }
                          }}
                          disabled={deleteNoteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

