import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const propertyDetailsSchema = z.object({
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().min(0.5).max(20).optional().nullable(),
  garageSpaces: z.number().int().min(0).optional().nullable(),
  estimatedPrice: z.number().min(0).optional().nullable(),
  propertyType: z.enum(['house', 'apartment', 'townhouse', 'condo', 'land', 'commercial', 'other']).optional().nullable(),
  landSizeM2: z.number().min(0).optional().nullable(),
  interiorSizeM2: z.number().min(0).optional().nullable(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional().nullable(),
  yearRenovated: z.number().int().min(1800).max(new Date().getFullYear() + 1).optional().nullable(),
  propertyStatus: z.enum(['for_sale', 'sold', 'pending', 'off_market', 'rental', 'other']).optional().nullable(),
  listingDate: z.string().optional().nullable(),
  mlsNumber: z.string().optional().nullable(),
  propertyDescription: z.string().optional().nullable(),
  propertyFeatures: z.array(z.string()).optional().nullable(),
  propertyCondition: z.enum(['excellent', 'good', 'fair', 'needs_renovation', 'other']).optional().nullable(),
  hoaFees: z.number().min(0).optional().nullable(),
  propertyTaxes: z.number().min(0).optional().nullable(),
  schoolDistrict: z.string().optional().nullable(),
});

type PropertyDetailsFormData = z.infer<typeof propertyDetailsSchema>;

interface PropertyDetailsFormProps {
  initialData?: Partial<PropertyDetailsFormData>;
  onSubmit: (data: PropertyDetailsFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PropertyDetailsForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: PropertyDetailsFormProps) {
  const form = useForm<PropertyDetailsFormData>({
    resolver: zodResolver(propertyDetailsSchema),
    defaultValues: {
      bedrooms: initialData?.bedrooms ?? null,
      bathrooms: initialData?.bathrooms ?? null,
      garageSpaces: initialData?.garageSpaces ?? null,
      estimatedPrice: initialData?.estimatedPrice ?? null,
      propertyType: initialData?.propertyType ?? null,
      landSizeM2: initialData?.landSizeM2 ?? null,
      interiorSizeM2: initialData?.interiorSizeM2 ?? null,
      yearBuilt: initialData?.yearBuilt ?? null,
      yearRenovated: initialData?.yearRenovated ?? null,
      propertyStatus: initialData?.propertyStatus ?? null,
      listingDate: initialData?.listingDate ?? null,
      mlsNumber: initialData?.mlsNumber ?? null,
      propertyDescription: initialData?.propertyDescription ?? null,
      propertyFeatures: initialData?.propertyFeatures ?? [],
      propertyCondition: initialData?.propertyCondition ?? null,
      hoaFees: initialData?.hoaFees ?? null,
      propertyTaxes: initialData?.propertyTaxes ?? null,
      schoolDistrict: initialData?.schoolDistrict ?? null,
    },
  });

  const handleSubmit = async (data: PropertyDetailsFormData) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bedrooms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bedrooms</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="3"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bathrooms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bathrooms</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="2.5"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="garageSpaces"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Garage Spaces</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimatedPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="500000"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="propertyType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Type</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="propertyStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Status</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="for_sale">For Sale</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="off_market">Off Market</SelectItem>
                    <SelectItem value="rental">Rental</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="landSizeM2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Land Size (m²)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="500"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="interiorSizeM2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interior Size (m²)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="200"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="yearBuilt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year Built</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2020"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="yearRenovated"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year Renovated</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="2023"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="listingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Listing Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mlsNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>MLS Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="MLS-12345"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="propertyCondition"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Condition</FormLabel>
                <Select
                  value={field.value ?? ''}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="needs_renovation">Needs Renovation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hoaFees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HOA Fees</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="200"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="propertyTaxes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Property Taxes</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="5000"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="schoolDistrict"
            render={({ field }) => (
              <FormItem>
                <FormLabel>School District</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Springfield School District"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="propertyDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Property Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the property..."
                  rows={4}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Property Details'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

