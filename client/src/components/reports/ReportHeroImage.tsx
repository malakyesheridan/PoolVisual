interface ReportHeroImageProps {
  imageUrl: string | null;
  address?: string;
}

export function ReportHeroImage({ imageUrl, address }: ReportHeroImageProps) {
  if (!imageUrl) return null;

  return (
    <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden mb-8 shadow-lg">
      <img
        src={imageUrl}
        alt={address || 'Property'}
        className="w-full h-full object-cover"
      />
      {address && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{address}</h1>
        </div>
      )}
    </div>
  );
}

