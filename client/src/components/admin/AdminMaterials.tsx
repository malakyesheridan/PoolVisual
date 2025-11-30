import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Search, 
  Loader2, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Image as ImageIcon
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Format currency
const formatCurrency = (num: number | string | null | undefined) => {
  if (!num) return '$0.00';
  const value = typeof num === 'string' ? parseFloat(num) : num;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUD' }).format(value);
};

export function AdminMaterials() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'materials', page, search, categoryFilter],
    queryFn: () => apiClient.getAdminMaterials({ 
      page, 
      limit: 20, 
      ...(search ? { search } : {}),
      ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    }),
    staleTime: 10 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" />
          <p>Error loading materials: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </CardContent>
      </Card>
    );
  }

  const materials = data?.materials || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Materials
        </CardTitle>
        <CardDescription>
          Manage and view all materials in the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search materials by name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select value={categoryFilter} onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="tiles">Tiles</SelectItem>
                <SelectItem value="coping">Coping</SelectItem>
                <SelectItem value="waterline">Waterline</SelectItem>
                <SelectItem value="decking">Decking</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Materials Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Material</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Price</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Unit</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Organization</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {materials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No materials found
                  </td>
                </tr>
              ) : (
                materials.map((material: any) => (
                  <tr key={material.id} className="hover:bg-slate-50 border-b">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {material.imageUrl ? (
                          <img 
                            src={material.imageUrl} 
                            alt={material.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{material.name}</div>
                          {material.supplier && (
                            <div className="text-sm text-slate-500">{material.supplier}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {material.sku || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{material.category || 'N/A'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {material.price ? formatCurrency(material.price) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {material.unit || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {material.orgId ? 'Organization-specific' : 'Global'}
                    </td>
                    <td className="px-4 py-3">
                      {material.isActive !== false ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-slate-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} materials
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page === pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
