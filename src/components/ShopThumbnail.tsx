import { useState } from 'react';
import { Store } from 'lucide-react';
import { ShopPhoto } from '../types';

interface ShopThumbnailProps {
  photos?: ShopPhoto[];
  shopName: string;
  className?: string;
  maxWidthPx?: number;
  maxHeightPx?: number;
}

export function ShopThumbnail({
  photos,
  shopName,
  className = 'w-14 h-11 rounded-md',
  maxWidthPx = 400,
  maxHeightPx = 300,
}: ShopThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const photoName = photos?.[0]?.name;

  if (!photoName || failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0`}
        title={shopName}
      >
        <Store className="w-4 h-4" />
      </div>
    );
  }

  const src = `/api/places/photo?name=${encodeURIComponent(
    photoName
  )}&maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}`;

  return (
    <img
      src={src}
      alt={shopName}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-slate-100 border border-slate-200 shrink-0`}
    />
  );
}
