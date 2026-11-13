import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { CheckCircle2, LogIn, MapPin, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import { BusinessScale, ShopCategory } from '../types';

export function ListShopView({ onSuccess }: { onSuccess: () => void }) {
  const { user, profile, signInWithGoogle } = useAuth();
  const placesLib = useMapsLibrary('places');

  const [placeSearch, setPlaceSearch] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(profile?.displayName || '');
  const [category, setCategory] = useState<Exclude<ShopCategory, 'all'>>('groceries');
  const [businessScale, setBusinessScale] = useState<BusinessScale>('small');
  const [city, setCity] = useState(profile?.preferredCity || 'New Delhi');
  const [locality, setLocality] = useState('');
  const [goodsSummary, setGoodsSummary] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState(5);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { suggestions, resetSession } = useAutocompleteSuggestions(
    selectedPlaceId ? '' : placeSearch
  );

  const handleSelectPrediction = async (
    s: google.maps.places.AutocompleteSuggestion
  ) => {
    const pred = s.placePrediction;
    if (!pred) return;
    setPlaceSearch(pred.text?.text || '');
    if (placesLib) {
      try {
        const place = pred.toPlace();
        await place.fetchFields({
          fields: ['id', 'displayName', 'formattedAddress'],
        });
        resetSession();
        const safeId = (place.id || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
        setSelectedPlaceId(safeId);
        if (place.displayName) setBusinessName(place.displayName);
        if (place.formattedAddress) {
          setLocality(place.formattedAddress.slice(0, 200));
          const parts = place.formattedAddress.split(',').map((p: string) => p.trim());
          if (parts.length >= 3) {
            setCity(parts[parts.length - 3].slice(0, 80));
          }
        }
      } catch {
        resetSession();
      }
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto my-14 bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <Store className="w-10 h-10 text-emerald-600 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">
          Register Your Indian Shop or Business
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Whether you run a neighborhood kirana, cold drink corner, saree shop, or wholesale electronics showroom in India, sign in to link your Google Maps storefront and publish your owner details.
        </p>
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-2 cursor-pointer"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In to Register Shop</span>
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedSuccess(false);

    if (!selectedPlaceId) {
      setError('Please select your shop from the Google Maps India search suggestions above.');
      return;
    }

    if (
      ownerName.trim().length < 2 ||
      businessName.trim().length < 2 ||
      goodsSummary.trim().length < 3
    ) {
      setError('Please complete Owner Name, Business Name, and Goods Sold.');
      return;
    }

    setSaving(true);
    const path = `shop_owners/${selectedPlaceId}`;
    try {
      await setDoc(doc(db, 'shop_owners', selectedPlaceId), {
        placeId: selectedPlaceId,
        ownerUid: user.uid,
        ownerName: ownerName.trim().slice(0, 100),
        businessName: businessName.trim().slice(0, 140),
        category,
        businessScale,
        city: city.trim().slice(0, 80) || 'India',
        locality: locality.trim().slice(0, 200) || city.trim(),
        goodsSummary: goodsSummary.trim().slice(0, 300),
        deliveryAvailable,
        yearsInBusiness: Math.min(Math.max(Number(yearsInBusiness) || 0, 0), 200),
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSavedSuccess(true);
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (formatted) {
        setError(
          formatted instanceof Error ? formatted.message : 'Unable to save owner listing.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Shopkeeper &amp; Business Owner Directory Form
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Connect your Google Maps storefront in India and publish transparent owner, scale, and product details for local customers.
          </p>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Owner profile published to BazaarAtlas directory!</span>
            </div>
            <button
              type="button"
              onClick={onSuccess}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer"
            >
              View Directory
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Google Maps Shop Linker */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              1. Find Your Shop on Google Maps (India)
            </label>
            <input
              type="text"
              value={placeSearch}
              onChange={(e) => {
                setPlaceSearch(e.target.value);
                setSelectedPlaceId('');
              }}
              placeholder="Type your shop name & Indian city (e.g. Gupta Kirana Lajpat Nagar)..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
            {suggestions.length > 0 && !selectedPlaceId && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-52 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map((s, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => void handleSelectPrediction(s)}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{s.placePrediction?.text?.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedPlaceId && (
              <p className="text-xs text-emerald-700 mt-1">
                Linked Google Place ID: <span className="font-mono-data">{selectedPlaceId}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner / Proprietor Name
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Suresh Agrawal"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shop / Business Name
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Agrawal Provision & Cold Drinks"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Goods Category
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as Exclude<ShopCategory, 'all'>)
                }
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
              >
                <option value="cloths">Cloths &amp; Apparel</option>
                <option value="groceries">Groceries &amp; Kirana</option>
                <option value="electronics">Electronics &amp; Appliances</option>
                <option value="restaurant">Restaurant &amp; Eatery</option>
                <option value="household">Household Items</option>
                <option value="cold_drinks">Cold Drinks &amp; Beverages</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Scale
              </label>
              <select
                value={businessScale}
                onChange={(e) => setBusinessScale(e.target.value as BusinessScale)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-600"
              >
                <option value="small">Small Shopkeeper / Local Stall</option>
                <option value="medium">Medium Retailer</option>
                <option value="large">Big Businessman / Wholesaler / Showroom</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Indian City
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Market / Street Locality
              </label>
              <input
                type="text"
                required
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
                placeholder="Shop No. 14, Main Market..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Goods &amp; Products Available
            </label>
            <textarea
              rows={2}
              required
              value={goodsSummary}
              onChange={(e) => setGoodsSummary(e.target.value)}
              placeholder="List main items sold (e.g. Basmati rice, cold drinks, LED bulbs, steel utensils, cotton kurtis)..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Years in Business:
              </label>
              <input
                type="number"
                min={0}
                max={200}
                value={yearsInBusiness}
                onChange={(e) => setYearsInBusiness(Number(e.target.value))}
                className="w-20 px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={deliveryAvailable}
                onChange={(e) => setDeliveryAvailable(e.target.checked)}
              />
              Home Delivery Available
            </label>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {saving ? 'Publishing...' : 'Publish Shop Owner Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
