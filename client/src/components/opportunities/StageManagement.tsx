import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface StageManagementProps {
  stage: Stage;
  pipelineId: string;
  onStageUpdated: () => void;
}

export function StageManagement({ stage, pipelineId, onStageUpdated }: StageManagementProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(stage.name);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6B7280');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast({
        title: 'Error',
        description: 'Stage name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiClient.updatePipelineStageName(stage.id, editedName.trim());
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines', pipelineId, 'stages'] });
      onStageUpdated();
      toast({
        title: 'Success',
        description: 'Stage name updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update stage name',
        variant: 'destructive',
      });
    }
  };

  const handleResetName = async () => {
    try {
      const defaultStage = await apiClient.resetPipelineStageName(stage.id);
      setEditedName(defaultStage.name);
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines', pipelineId, 'stages'] });
      onStageUpdated();
      toast({
        title: 'Success',
        description: 'Stage name reset to default',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset stage name',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStage = async () => {
    try {
      await apiClient.deletePipelineStage(stage.id);
      setIsDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines', pipelineId, 'stages'] });
      onStageUpdated();
      toast({
        title: 'Success',
        description: 'Stage deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete stage',
        variant: 'destructive',
      });
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) {
      toast({
        title: 'Error',
        description: 'Stage name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const existingStages = await apiClient.getPipelineStages(pipelineId);
      const maxOrder = existingStages.length > 0 
        ? Math.max(...existingStages.map((s: Stage) => s.order), -1)
        : -1;
      await apiClient.createPipelineStage(pipelineId, {
        name: newStageName.trim(),
        color: newStageColor,
        order: maxOrder + 1,
      });
      setNewStageName('');
      setNewStageColor('#6B7280');
      setIsAddingStage(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines', pipelineId, 'stages'] });
      onStageUpdated();
      toast({
        title: 'Success',
        description: 'Stage added',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add stage',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveName();
                } else if (e.key === 'Escape') {
                  setEditedName(stage.name);
                  setIsEditingName(false);
                }
              }}
              className="h-7 text-xs px-2 py-1"
              autoFocus
              placeholder="Stage name"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-green-100"
              onClick={handleSaveName}
              title="Save (Enter)"
            >
              <Check className="w-3 h-3 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-red-100"
              onClick={() => {
                setEditedName(stage.name);
                setIsEditingName(false);
              }}
              title="Cancel (Esc)"
            >
              <X className="w-3 h-3 text-red-600" />
            </Button>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsEditingName(true)}
              title="Edit stage name"
            >
              <Pencil className="w-3 h-3 text-slate-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsAddingStage(true)}
              title="Add new stage"
            >
              <Plus className="w-3 h-3 text-slate-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setIsDeleteDialogOpen(true)}
              title="Delete stage"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </Button>
          </>
        )}
      </div>

      {/* Add Stage Dialog */}
      <Dialog open={isAddingStage} onOpenChange={setIsAddingStage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Stage</DialogTitle>
            <DialogDescription>
              Create a new stage for your pipeline
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Stage Name</label>
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Enter stage name"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddStage();
                  }
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="w-12 h-8 rounded border border-slate-300 cursor-pointer"
                />
                <Input
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  placeholder="#6B7280"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingStage(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddStage}>Add Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the stage "{stage.name}"? This action cannot be undone.
              If there are opportunities in this stage, you'll need to move them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

