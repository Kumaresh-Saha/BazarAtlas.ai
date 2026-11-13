import { Heart, Navigation, Plus, Check, Star, ArrowUpDown, Store } from 'lucide-react';
import { CATEGORY_LABELS } from '../constants';
import { Shop, ShopOwnerProfile } from '../types';
import { ShopThumbnail } from './ShopThumbnail';

export type SortField = 'distance' | 'rating' | 'reviews';

interface ShopTableProps {
  shops: Shop[];
  isLoading: boolean;
  error: string | null;
  selectedPlaceId: string | null;
  routeStopIds: string[];
  favoriteIds: Record<string, boolean>;
  shopOwners: Record<string, ShopOwnerProfile>;
  sortField: SortField;
  onSortChange: (field: SortField) => void;
  onSelectShop: (shop: Shop) => void;
  onToggleFavorite: (shop: Shop) => void;
  onToggleRouteStop: (shop: Shop) => void;
  onNavigateNow: (shop: Shop) => void;
  hasNextPage: boolean;
  onLoadMore: () => void;
  onRetryCollect: () => void;
  originLabel: string;
}

export function ShopTable({
  shops,
  isLoading,
  error,
  selectedPlaceId,
  routeStopIds,
  favoriteIds,
  shopOwners,
  sortField,
  onSortChange,
  onSelectShop,
  onToggleFavorite,
  onToggleRouteStop,
  onNavigateNow,
  hasNextPage,
  onLoadMore,
  onRetryCollect,
  originLabel,
}: ShopTableProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      {/* Compact Header Bar */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-900 tabular-nums">
            {shops.length} {shops.length === 1 ? 'Shop' : 'Shops'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate max-w-[260px]">Near {originLabel}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Sort:</span>
          {(
            [
              { id: 'distance', label: 'Nearest' },
              { id: 'rating', label: 'Top Rated' },
              { id: 'reviews', label: 'Most Reviewed' },
            ] as Array<{ id: SortField; label: string }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSortChange(opt.id)}
              className={`px-2 py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sortField === opt.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetryCollect}
            className="px-2.5 py-1 bg-white border border-red-300 rounded font-medium text-red-900 hover:bg-red-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Spacious, Uncongested Shop Information Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-white">
              <th className="py-2.5 px-4">Shop &amp; Goods</th>
              <th className="py-2.5 px-3 hidden sm:table-cell">Location &amp; Owner</th>
              <th className="py-2.5 px-3 text-right">Rating</th>
              <th className="py-2.5 px-3 text-right">Distance</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {isLoading && shops.length === 0 &&
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-11 rounded-md bg-slate-200 shrink-0" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-36 bg-slate-200 rounded" />
                        <div className="h-3 w-24 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 hidden sm:table-cell">
                    <div className="h-3.5 w-40 bg-slate-100 rounded" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="h-3.5 w-14 bg-slate-100 rounded ml-auto" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="h-3.5 w-12 bg-slate-100 rounded ml-auto" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="h-7 w-24 bg-slate-100 rounded ml-auto" />
                  </td>
                </tr>
              ))}

            {!isLoading && shops.length === 0 && (
              <tr>
                <td colSpan={5} className="py-14 px-6 text-center">
                  <Store className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-slate-800">
                    No shops collected for this filter yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Try searching a locality, shop name, or item (e.g., &ldquo;kirana store&rdquo;, &ldquo;cold drinks&rdquo;, or &ldquo;T Nagar&rdquo;).
                  </p>
                  <button
                    type="button"
                    onClick={onRetryCollect}
                    className="mt-4 px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Collect Nearby Shops
                  </button>
                </td>
              </tr>
            )}

            {shops.map((shop) => {
              const isSelected = selectedPlaceId === shop.placeId;
              const isFav = Boolean(favoriteIds[shop.placeId]);
              const isInRoute = routeStopIds.includes(shop.placeId);
              const ownerInfo = shopOwners[shop.placeId];
              const categoryName = CATEGORY_LABELS[shop.category] || 'Retail';

              return (
                <tr
                  key={shop.placeId}
                  onClick={() => onSelectShop(shop)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Column 1: Shop Photo + Name + Clean Unboxed Metadata */}
                  <td className="py-3 px-4 align-middle">
                    <div className="flex items-center gap-3 min-w-0">
                      <ShopThumbnail
                        photos={shop.photos}
                        shopName={shop.name}
                        className="w-14 h-11 rounded-md"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-[240px]">
                          {shop.name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate max-w-[240px]">
                          <span>{categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ownerInfo ? ownerInfo.businessScale === 'small' ? 'Small Shopkeeper' : ownerInfo.businessScale === 'large' ? 'Big Business' : 'Medium Retailer' : shop.scaleLabel}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Location & Owner */}
                  <td className="py-3 px-3 align-middle hidden sm:table-cell">
                    <div className="text-xs text-slate-700 truncate max-w-[220px]">
                      {shop.shortAddress}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">
                      {ownerInfo ? (
                        <span className="text-emerald-700 font-medium">
                          Owner: {ownerInfo.ownerName}
                        </span>
                      ) : shop.openNow === true ? (
                        <span className="text-emerald-700">Open Now</span>
                      ) : shop.openNow === false ? (
                        <span className="text-amber-700">Closed Currently</span>
                      ) : (
                        <span>{shop.primaryTypeLabel}</span>
                      )}
                    </div>
                  </td>

                  {/* Column 3: Rating & Review Count */}
                  <td className="py-3 px-3 align-middle text-right whitespace-nowrap">
                    {shop.rating ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 font-mono-data">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {shop.rating.toFixed(1)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono-data">
                          ({shop.userRatingCount.toLocaleString('en-IN')})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">New</span>
                    )}
                  </td>

                  {/* Column 4: Distance & ETA */}
                  <td className="py-3 px-3 align-middle text-right whitespace-nowrap">
                    <div className="text-xs font-medium text-slate-900 font-mono-data">
                      {typeof shop.distanceKm === 'number'
                        ? `${shop.distanceKm.toFixed(1)} km`
                        : '—'}
                    </div>
                    {shop.etaText && (
                      <div className="text-[11px] text-slate-500 font-mono-data">
                        {shop.etaText}
                      </div>
                    )}
                  </td>

                  {/* Column 5: Quick Actions */}
                  <td
                    className="py-3 px-4 align-middle text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(shop)}
                        title={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                        aria-label={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                        className={`p-2 rounded-md border transition-colors cursor-pointer ${
                          isFav
                            ? 'bg-rose-50 border-rose-200 text-rose-600'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-600' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleRouteStop(shop)}
                        title={isInRoute ? 'Remove from Route' : 'Add to Multi-Stop Route'}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                          isInRoute
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isInRoute ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Route</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateNow(shop)}
                        title="Get Directions & Live Navigation"
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Go</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination */}
      {hasNextPage && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? 'Collecting more shops...' : 'Collect More Shops from Google'}
          </button>
        </div>
      )}
    </div>
  );
}
