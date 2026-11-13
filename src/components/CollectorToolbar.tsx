import React, { useRef, useState } from 'react';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { CATEGORY_CONFIG, INDIAN_CITIES } from '../constants';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import { BusinessScale, ShopCategory } from '../types';

interface CollectorToolbarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearchSubmit: (overrideQuery?: string, overrideCoords?: { lat: number; lng: number; label?: string }) => void;
  category: ShopCategory;
  onCategoryChange: (cat: ShopCategory) => void;
  scaleFilter: BusinessScale | 'all';
  onScaleFilterChange: (scale: BusinessScale | 'all') => void;
  selectedCityId: string;
  onCitySelect: (cityId: string) => void;
  onUseGps: () => void;
  gpsLoading: boolean;
  isUsingGps: boolean;
  origin: { lat: number; lng: number; label: string };
  isCollecting: boolean;
}

export function CollectorToolbar({
  query,
  onQueryChange,
  onSearchSubmit,
  category,
  onCategoryChange,
  scaleFilter,
  onScaleFilterChange,
  selectedCityId,
  onCitySelect,
  onUseGps,
  gpsLoading,
  isUsingGps,
  origin,
  isCollecting,
}: CollectorToolbarProps) {
  const placesLib = useMapsLibrary('places');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { suggestions, resetSession } = useAutocompleteSuggestions(
    dropdownOpen ? query : '',
    { lat: origin.lat, lng: origin.lng }
  );
  const blurTimerRef = useRef<number | null>(null);

  const handleSuggestionPick = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    const text = prediction.text?.text || '';
    onQueryChange(text);
    setDropdownOpen(false);

    if (placesLib) {
      try {
        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ['location', 'displayName', 'formattedAddress'],
        });
        resetSession();
        const loc = place.location;
        if (loc) {
          onSearchSubmit(text, {
            lat: loc.lat(),
            lng: loc.lng(),
            label: place.displayName || text,
          });
          return;
        }
      } catch {
        resetSession();
      }
    }
    onSearchSubmit(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDropdownOpen(false);
    onSearchSubmit();
  };

  return (
    <section className="bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 space-y-3.5">
        {/* Top Row: Search Box + Indian Location Origin */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <form onSubmit={handleSubmit} className="relative flex-1">
            <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/15 rounded-lg transition-all">
              <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
              <input
                type="text"
                value={query}
                onFocus={() => {
                  if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
                  setDropdownOpen(true);
                }}
                onBlur={() => {
                  blurTimerRef.current = window.setTimeout(
                    () => setDropdownOpen(false),
                    180
                  );
                }}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  setDropdownOpen(true);
                }}
                placeholder="Search shop name, goods (e.g. cold drinks, saree, kirana), or Indian locality..."
                className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    onQueryChange('');
                    resetSession();
                    onSearchSubmit('');
                  }}
                  aria-label="Clear search"
                  className="p-1.5 text-slate-400 hover:text-slate-700 mr-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isCollecting}
                className="m-1 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isCollecting ? 'Collecting...' : 'Find Shops'}
              </button>
            </div>

            {dropdownOpen && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map((s, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void handleSuggestionPick(s);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        {s.placePrediction?.text?.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {/* Indian City Preset & GPS Locator */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
              <label htmlFor="city-select" className="sr-only">
                Indian City
              </label>
              <select
                id="city-select"
                value={isUsingGps ? 'gps' : selectedCityId}
                onChange={(e) => {
                  if (e.target.value === 'gps') {
                    onUseGps();
                  } else {
                    onCitySelect(e.target.value);
                  }
                }}
                className="bg-transparent text-sm font-medium text-slate-800 focus:outline-none cursor-pointer pr-1"
              >
                {isUsingGps && <option value="gps">Current GPS Location</option>}
                {INDIAN_CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onUseGps}
              disabled={gpsLoading}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isUsingGps
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <LocateFixed className="w-4 h-4" />
              <span>{gpsLoading ? 'Locating...' : 'Near Me'}</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Category Tabs + Business Scale Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {CATEGORY_CONFIG.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryChange(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Business Scale:
            </span>
            <select
              value={scaleFilter}
              onChange={(e) =>
                onScaleFilterChange(e.target.value as BusinessScale | 'all')
              }
              className="text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="all">All Owners (Small to Large)</option>
              <option value="small">Small Shopkeeper</option>
              <option value="medium">Medium Retailer</option>
              <option value="large">Big Business / Showroom</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
