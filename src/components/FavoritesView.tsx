import { useState } from 'react';
import { Heart, LogIn, Navigation, Route, Trash2, Check, Edit3 } from 'lucide-react';
import { CATEGORY_LABELS, SCALE_LABELS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { FavoriteShop, Shop } from '../types';

interface FavoritesViewProps {
  onOpenPlaceDetails: (placeId: string, fallbackShop: Shop) => void;
  onOptimizeFavoritesRoute: (shops: Shop[]) => void;
  onBrowseDirectory: () => void;
}

function favoriteToShop(fav: FavoriteShop): Shop {
  return {
    placeId: fav.placeId,
    name: fav.shopName,
    category: fav.category,
    primaryTypeLabel: CATEGORY_LABELS[fav.category] || 'Retail Store',
    scale: fav.scale,
    scaleLabel: SCALE_LABELS[fav.scale] || 'Local Shop',
    shortAddress: fav.shortAddress,
    formattedAddress: fav.shortAddress,
    lat: fav.lat,
    lng: fav.lng,
    rating: null,
    userRatingCount: 0,
    photos: [],
    reviews: [],
  };
}

export function FavoritesView({
  onOpenPlaceDetails,
  onOptimizeFavoritesRoute,
  onBrowseDirectory,
}: FavoritesViewProps) {
  const { user, favorites, toggleFavorite, updateFavoriteNote, signInWithGoogle } =
    useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto my-14 bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <Heart className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">
          Save Your Favorite Indian Shops
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Sign in to bookmark kirana stores, textile showrooms, electronics dealers, restaurants, and cold drink shops, add personal notes, and optimize multi-stop routes across your saved places.
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign Up / Sign In with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Saved Favorite Shops
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {favorites.length} {favorites.length === 1 ? 'shop' : 'shops'} saved to your personal list
          </p>
        </div>

        <div className="flex items-center gap-3">
          {favorites.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onOptimizeFavoritesRoute(favorites.slice(0, 6).map(favoriteToShop))
              }
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Route className="w-4 h-4" />
              <span>Optimize Route ({Math.min(favorites.length, 6)} Stops)</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBrowseDirectory}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            Browse Directory
          </button>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Heart className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-base font-semibold text-slate-900">
            Your favorites list is empty
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Click the heart icon on any shop in the directory table or map to save it here for quick access and route planning.
          </p>
          <button
            type="button"
            onClick={onBrowseDirectory}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
          >
            Explore Shops
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((fav) => {
            const shopObj = favoriteToShop(fav);
            const isEditing = editingId === fav.placeId;
            return (
              <div
                key={fav.placeId}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span>{CATEGORY_LABELS[fav.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{SCALE_LABELS[fav.scale]}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {fav.shopName}
                  </h3>
                  <p className="text-xs text-slate-600">{fav.shortAddress}</p>

                  {isEditing ? (
                    <div className="pt-2 space-y-2">
                      <input
                        type="text"
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Add personal note (e.g. wholesale rate on spices)..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-emerald-600"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void updateFavoriteNote(fav.placeId, noteDraft);
                            setEditingId(null);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1 flex items-start justify-between gap-2 text-xs text-slate-500">
                      <span className="italic">
                        {fav.note ? `"${fav.note}"` : 'No personal note added'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(fav.placeId);
                          setNoteDraft(fav.note || '');
                        }}
                        className="text-emerald-700 hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Note</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenPlaceDetails(fav.placeId, shopObj)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    Live Photos &amp; Reviews
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOptimizeFavoritesRoute([shopObj])}
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Route</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(shopObj)}
                      title="Remove favorite"
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md border border-slate-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
