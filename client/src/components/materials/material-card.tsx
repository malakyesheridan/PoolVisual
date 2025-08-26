import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
      
      <h4 className="text-sm font-medium text-slate-900 mb-1" data-testid={`text-material-name-${material.id}`}>
        {material.name}
      </h4>
      
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
