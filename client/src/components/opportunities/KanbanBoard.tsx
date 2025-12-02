import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, DollarSign, CheckCircle, XCircle, Clock, MoreHorizontal } from 'lucide-react';
import { formatCurrency } from '@/lib/measurement-utils';
import { formatDistanceToNow } from 'date-fns';

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
  tags?: string[];
  taskCount?: number;
  completedTaskCount?: number;
  ownerId?: string;
  ownerName?: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface KanbanBoardProps {
  opportunities: Opportunity[];
  stages: Stage[];
  onOpportunityClick: (opportunity: Opportunity) => void;
  onOpportunityMove: (opportunityId: string, newStageId: string) => void;
  isLoading?: boolean;
}

function OpportunityCard({ 
  opportunity, 
  onClick 
}: { 
  opportunity: Opportunity; 
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'lost':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'abandoned':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'won':
        return CheckCircle;
      case 'lost':
        return XCircle;
      default:
        return Clock;
    }
  };

  const StatusIcon = getStatusIcon(opportunity.status);
  const pendingTasks = (opportunity.taskCount || 0) - (opportunity.completedTaskCount || 0);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${getStatusColor(opportunity.status)}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-sm flex-1">{opportunity.title}</h3>
          <Badge variant="outline" className={`ml-2 ${getStatusColor(opportunity.status)}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {opportunity.status}
          </Badge>
        </div>

        {opportunity.contactName && (
          <div className="text-xs text-slate-600 mb-2">
            <strong>{opportunity.contactName}</strong>
          </div>
        )}

        <div className="space-y-1 text-xs text-slate-600 mb-2">
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

        {opportunity.value && (
          <div className="flex items-center gap-1 text-sm font-medium text-slate-900 mb-2">
            <DollarSign className="w-3 h-3" />
            {formatCurrency(typeof opportunity.value === 'string' ? parseFloat(opportunity.value) : opportunity.value)}
          </div>
        )}

        {pendingTasks > 0 && (
          <div className="text-xs text-slate-500 mb-2">
            {pendingTasks} {pendingTasks === 1 ? 'task' : 'tasks'} remaining
          </div>
        )}

        {opportunity.tags && opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {opportunity.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {opportunity.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{opportunity.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StageColumn({ 
  stage, 
  opportunities, 
  onOpportunityClick 
}: { 
  stage: Stage; 
  opportunities: Opportunity[];
  onOpportunityClick: (opp: Opportunity) => void;
}) {
  return (
    <div
      className="flex-shrink-0 w-80 bg-slate-50 rounded-lg p-4"
      data-stage-id={stage.id}
      data-type="stage"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-slate-900">{stage.name}</h3>
          <Badge variant="secondary" className="ml-2">
            {opportunities.length}
          </Badge>
        </div>
      </div>

      <SortableContext
        items={opportunities.map(opp => opp.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[200px]">
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              onClick={() => onOpportunityClick(opportunity)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  opportunities,
  stages,
  onOpportunityClick,
  onOpportunityMove,
  isLoading = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedOpportunity, setDraggedOpportunity] = useState<Opportunity | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group opportunities by stage
  const opportunitiesByStage = useMemo(() => {
    const grouped: Record<string, Opportunity[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = [];
    });
    
    opportunities.forEach(opp => {
      const stageId = opp.stageId || 'unassigned';
      if (!grouped[stageId]) {
        grouped[stageId] = [];
      }
      grouped[stageId].push(opp);
    });

    return grouped;
  }, [opportunities, stages]);

  // Sort stages by order
  const sortedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.order - b.order);
  }, [stages]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const opp = opportunities.find(o => o.id === event.active.id);
    setDraggedOpportunity(opp || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic if needed
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedOpportunity(null);

    if (!over) return;

    const opportunityId = active.id as string;
    let newStageId: string | null = null;

    // Check if we're dropping on a stage column
    // First, try to find the stage column from the drop target
    const stageElement = (over.data.current as any)?.stageId 
      ? null 
      : document.elementFromPoint(
          (event as any).activatorEvent?.clientX || 0,
          (event as any).activatorEvent?.clientY || 0
        )?.closest('[data-stage-id]') as HTMLElement;
    
    if (stageElement?.dataset?.stageId) {
      newStageId = stageElement.dataset.stageId;
    } else if (stages.some(stage => stage.id === over.id as string)) {
      newStageId = over.id as string;
    } else {
      // Last resort: check if over is an opportunity in a stage column
      const parentStage = (over.data.current as any)?.stageId;
      if (parentStage) {
        newStageId = parentStage;
      }
    }

    if (newStageId && stages.some(s => s.id === newStageId)) {
      onOpportunityMove(opportunityId, newStageId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            opportunities={opportunitiesByStage[stage.id] || []}
            onOpportunityClick={onOpportunityClick}
          />
        ))}
      </div>

      <DragOverlay>
        {draggedOpportunity ? (
          <div className="opacity-90">
            <OpportunityCard
              opportunity={draggedOpportunity}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

