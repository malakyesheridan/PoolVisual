import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MaterialCardProps {
  material: {
    id: string;
    name: string;
    sku: string;
    price: number;
    unit: string;
    thumbnailUrl?: string;
    isActive: boolean;
  };
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MaterialCard({ 
  material, 
  isSelected = false, 
  onClick, 
  className 
}: MaterialCardProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const deleteMaterialMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/materials'] });
      toast({
        title: "Material deleted",
        description: `${material.name} has been removed from your library.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting material",
        description: error?.response?.data?.message || error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${material.name}"? This action cannot be undone.`)) {
      deleteMaterialMutation.mutate(material.id);
    }
    setShowDropdown(false);
  };

  return (
    <Card 
      className={cn(
        "material-card p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all",
        "hover:-translate-y-0.5 transform-gpu",
        isSelected && "ring-2 ring-primary",
        !material.isActive && "opacity-50",
        className
      )}
      onClick={onClick}
      data-testid={`card-material-${material.id}`}
    >
      {material.thumbnailUrl ? (
        <img 
          src={material.thumbnailUrl}
          alt={`${material.name} material texture`}
          className="w-full h-20 object-cover rounded-md mb-2"
          data-testid={`img-material-texture-${material.id}`}
        />
      ) : (
        <div className="w-full h-20 bg-slate-100 rounded-md mb-2 flex items-center justify-center">
          <div className="w-8 h-8 bg-slate-200 rounded" />
        </div>
      )}
      
      <div className="flex justify-between items-start mb-1">
        <h4 className="text-sm font-medium text-slate-900 flex-1" data-testid={`text-material-name-${material.id}`}>
          {material.name}
        </h4>
        
        {/* More Options Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="More options"
            data-testid={`button-material-options-${material.id}`}
          >
            <MoreVertical size={14} />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleteMaterialMutation.isPending}
                className="w-full px-3 py-2 text-left text-xs flex items-center space-x-2 transition-colors text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Delete material"
                data-testid={`button-delete-material-${material.id}`}
              >
                <Trash2 size={12} />
                <span>{deleteMaterialMutation.isPending ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      <p className="text-xs text-slate-600 mb-2" data-testid={`text-material-sku-${material.id}`}>
        {material.sku}
      </p>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500" data-testid={`text-material-price-${material.id}`}>
          ${material.price.toFixed(2)}/{material.unit}
        </span>
        
        <Badge 
          variant={material.isActive ? "default" : "secondary"}
          className={cn(
            "text-xs",
            material.isActive 
              ? "bg-green-100 text-green-800 hover:bg-green-100" 
              : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
          )}
          data-testid={`badge-material-status-${material.id}`}
        >
          {material.isActive ? "In Stock" : "Out of Stock"}
        </Badge>
      </div>
    </Card>
  );
}
