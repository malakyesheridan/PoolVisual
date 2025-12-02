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
        return 'bg-emerald-50 border-emerald-200';
      case 'lost':
        return 'bg-rose-50 border-rose-200';
      case 'abandoned':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-slate-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'lost':
        return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'abandoned':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300';
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

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`mb-3 cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${getStatusColor(opportunity.status)} ${isDragging ? 'shadow-xl scale-105' : ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing mb-2 flex items-center justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4 text-slate-400 hover:text-slate-600" />
        </div>

        <div className="mb-3">
          <h3 className="font-semibold text-base text-slate-900 mb-2 leading-tight">
            {opportunity.title || 'Untitled Opportunity'}
          </h3>
          <Badge variant="outline" className={`text-xs ${getStatusBadgeColor(opportunity.status)}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {opportunity.status}
          </Badge>
        </div>

        {opportunity.contactName && (
          <div className="mb-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium mb-1">
              <strong>{opportunity.contactName}</strong>
            </div>
            <div className="space-y-1 text-xs text-slate-500">
              {opportunity.contactPhone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{opportunity.contactPhone}</span>
                </div>
              )}
              {opportunity.contactEmail && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{opportunity.contactEmail}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {opportunity.value && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100">
              <DollarSign className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Value</div>
              <div className="text-base font-bold text-slate-900">
                {formatCurrency(typeof opportunity.value === 'string' ? parseFloat(opportunity.value) : opportunity.value)}
              </div>
            </div>
          </div>
        )}

        {pendingTasks > 0 && (
          <div className="flex items-center gap-2 mb-3 text-xs">
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-semibold">
              {pendingTasks}
            </div>
            <span className="text-slate-600">
              {pendingTasks === 1 ? 'task' : 'tasks'} pending
            </span>
          </div>
        )}

        {opportunity.tags && opportunity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            {opportunity.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 border-slate-200">
                {tag}
              </Badge>
            ))}
            {opportunity.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 border-slate-200">
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
      className="flex-shrink-0 w-80 bg-gradient-to-b from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200 shadow-sm"
      data-stage-id={stage.id}
      data-type="stage"
    >
      <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full shadow-sm border border-white/50"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">
            {stage.name}
          </h3>
        </div>
        <Badge variant="secondary" className="bg-white text-slate-700 border-slate-300 font-semibold px-2.5 py-0.5">
          {opportunities.length}
        </Badge>
      </div>

      <SortableContext
        items={opportunities.map(opp => opp.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3 min-h-[200px]">
          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No opportunities
            </div>
          ) : (
            opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                onClick={() => onOpportunityClick(opportunity)}
              />
            ))
          )}
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

  const opportunitiesByStage = useMemo(() => {
    const grouped: Record<string, Opportunity[]> = {};
    const stageIds = new Set(stages.map(s => s.id));
    
    // Initialize all known stages
    stages.forEach(stage => {
      grouped[stage.id] = [];
    });
    
    // Group opportunities by stage
    // CRITICAL: Only group opportunities that have a stageId matching a current stage
    // This ensures opportunities stay in their assigned stage and don't get moved to 'new'
    opportunities.forEach(opp => {
      const stageId = opp.stageId;
      
      // Only assign to a stage if stageId exists AND matches a current stage
      // If stageId doesn't match, don't show it yet - wait for stages to load
      // This prevents opportunities from being incorrectly moved to the first stage
      if (stageId && stageIds.has(stageId)) {
        // StageId matches a current stage - assign to that stage
        if (!grouped[stageId]) {
          grouped[stageId] = [];
        }
        grouped[stageId].push(opp);
      } else if (!stageId) {
        // No stageId at all - assign to first stage as fallback
        const fallbackStageId = stages.length > 0 ? stages[0].id : null;
        if (fallbackStageId) {
          if (!grouped[fallbackStageId]) {
            grouped[fallbackStageId] = [];
          }
          grouped[fallbackStageId].push(opp);
        }
      }
      // If stageId exists but doesn't match any current stage, don't show it
      // The stageId is preserved in the opportunity data, so once stages load it will appear correctly
    });

    return grouped;
  }, [opportunities, stages]);

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
      <div className="flex gap-5 overflow-x-auto pb-6 px-1" style={{ scrollbarWidth: 'thin' }}>
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
          <div className="opacity-95 rotate-2 shadow-2xl">
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

