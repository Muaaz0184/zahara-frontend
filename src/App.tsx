import React, { useState, useEffect, useRef } from 'react';

interface BookingRecord {
  id: string;
  code: string;
  pickup: string;
  drop: string;
  truck: string;
  weight: number;
  goods: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED';
  bookingTimestamp: string;
  driverOtp: string;
  pickupCoordinates: string;
  dropCoordinates: string;
}

interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const API_BASE = 'http://127.0.0.1:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'owner' | 'driver'>('customer');

  // Owner Credentials
  const OWNER_NAME = 'Mohammed Huzaifa';
  const OWNER_PASS = '7204@';
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [enteredPass, setEnteredPass] = useState('');
  const [passError, setPassError] = useState(false);

  // Live Backend Bookings
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);

  // Customer Form State
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState('12.9716° N, 77.5946° E');
  const [drop, setDrop] = useState('');
  const [dropCoords, setDropCoords] = useState('13.3408° N, 74.7421° E');
  const [weight, setWeight] = useState('');
  const [goods, setGoods] = useState('');
  const [selectedTruck, setSelectedTruck] = useState<'3T' | '13T'>('3T');
  const [recentBooking, setRecentBooking] = useState<BookingRecord | null>(null);

  // Live Auto-complete Location Suggestions
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDrop, setIsSearchingDrop] = useState(false);

  // Tracking State
  const [trackInput, setTrackInput] = useState('');
  const [searchResult, setSearchResult] = useState<BookingRecord | null | 'NOT_FOUND'>(null);

  // Driver Portal State
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [driverInputOtp, setDriverInputOtp] = useState('');
  const [isLocationGranted, setIsLocationGranted] = useState(false);
  const [otpError, setOtpError] = useState(false);

  // Fixed browser-safe setTimeout ref (resolves NodeJS.Timeout TS Error)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch live Pan-India villages, towns & cities from OpenStreetMap Nominatim API
  const searchIndiaLocations = (query: string, type: 'pickup' | 'drop') => {
    if (query.trim().length < 3) {
      if (type === 'pickup') setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        if (type === 'pickup') setIsSearchingPickup(true);
        else setIsSearchingDrop(true);

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
          )}&countrycodes=in&addressdetails=1&limit=6`
        );
        if (!response.ok) throw new Error('Network error');
        const data: LocationSuggestion[] = await response.json();

        if (type === 'pickup') {
          setPickupSuggestions(Array.isArray(data) ? data : []);
          setIsSearchingPickup(false);
        } else {
          setDropSuggestions(Array.isArray(data) ? data : []);
          setIsSearchingDrop(false);
        }
      } catch {
        if (type === 'pickup') setIsSearchingPickup(false);
        else setIsSearchingDrop(false);
      }
    }, 350);
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_BASE}/bookings`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
        if (data.length > 0) {
          setSelectedTripId((prev) => (prev ? prev : data[0].id));
        }
        setBackendOnline(true);
      }
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTabSwitch = (tab: 'customer' | 'owner' | 'driver') => {
    if (tab === 'owner' && !isOwnerAuthenticated) {
      setShowPassModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const handlePassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPass === OWNER_PASS) {
      setIsOwnerAuthenticated(true);
      setShowPassModal(false);
      setEnteredPass('');
      setPassError(false);
      setActiveTab('owner');
    } else {
      setPassError(true);
      setEnteredPass('');
    }
  };

  const handleOwnerLogout = () => {
    setIsOwnerAuthenticated(false);
    setActiveTab('customer');
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      pickup,
      drop,
      pickupCoordinates: pickupCoords,
      dropCoordinates: dropCoords,
      truck: selectedTruck === '3T' ? 'Tata Intra Goods (3T)' : 'Eicher Canter (13T)',
      weight: parseFloat(weight) || 1,
      goods: goods || 'General Goods'
    };

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newRecord = await res.json();
        setRecentBooking(newRecord);
        fetchBookings();
        setPickup('');
        setDrop('');
        setWeight('');
        setGoods('');
        setPickupSuggestions([]);
        setDropSuggestions([]);
      }
    } catch {
      alert('Unable to connect to Express backend server on port 5000.');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackInput.trim()) return;
    const match = bookings.find((b) => b.code.toUpperCase() === trackInput.trim().toUpperCase());
    setSearchResult(match || 'NOT_FOUND');
  };

  const updateBookingStatus = async (id: string, newStatus: BookingRecord['status']) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchBookings();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDriverOtpVerification = (e: React.FormEvent) => {
    e.preventDefault();
    const currentTrip = bookings.find((b) => b.id === selectedTripId);
    if (currentTrip && currentTrip.driverOtp === driverInputOtp.trim()) {
      setIsLocationGranted(true);
      setOtpError(false);
    } else {
      setOtpError(true);
      setIsLocationGranted(false);
    }
  };

  const activeDriverTrip = bookings.find((b) => b.id === selectedTripId) || bookings[0] || null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#22c55e', letterSpacing: '1px' }}>
              ZAHARA ROAD LINES
            </h1>
            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: backendOnline ? '#14532d' : '#7f1d1d', color: backendOnline ? '#4ade80' : '#fca5a5', fontWeight: '700' }}>
              {backendOnline ? 'BACKEND CONNECTED' : 'BACKEND OFFLINE'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Pan-India Freight Logistics: Cities, Taluks & All Villages Covered</p>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <button
              onClick={() => handleTabSwitch('customer')}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                backgroundColor: activeTab === 'customer' ? '#16a34a' : 'transparent',
                color: activeTab === 'customer' ? '#ffffff' : '#94a3b8'
              }}
            >
              Customer Booking
            </button>
            <button
              onClick={() => handleTabSwitch('driver')}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                backgroundColor: activeTab === 'driver' ? '#2563eb' : 'transparent',
                color: activeTab === 'driver' ? '#ffffff' : '#94a3b8'
              }}
            >
              🚚 Driver Portal
            </button>
            <button
              onClick={() => handleTabSwitch('owner')}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13px',
                backgroundColor: activeTab === 'owner' ? '#16a34a' : 'transparent',
                color: activeTab === 'owner' ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🔒 Owner Portal</span>
              {isOwnerAuthenticated && (
                <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '10px' }}>
                  {bookings.length}
                </span>
              )}
            </button>
          </div>

          {isOwnerAuthenticated && activeTab === 'owner' && (
            <button
              onClick={handleOwnerLogout}
              style={{ padding: '8px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        
        {/* CUSTOMER TAB */}
        {activeTab === 'customer' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '18px', color: '#38bdf8', margin: 0 }}>Book Freight Transport</h2>
                <span style={{ fontSize: '11px', color: '#4ade80', backgroundColor: '#14532d', padding: '3px 8px', borderRadius: '12px', fontWeight: '700' }}>
                  🇮🇳 All India Live Geocoding
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '12px', marginTop: 0, marginBottom: '16px' }}>
                Type any village name, taluk, town, city, or postal pincode in India.
              </p>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div
                  onClick={() => setSelectedTruck('3T')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: selectedTruck === '3T' ? '2px solid #22c55e' : '1px solid #475569',
                    backgroundColor: selectedTruck === '3T' ? '#14532d' : '#0f172a',
                    textAlign: 'center'
                  }}
                >
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>Tata Intra</p>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Max 3 Tons</span>
                </div>
                <div
                  onClick={() => setSelectedTruck('13T')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    border: selectedTruck === '13T' ? '2px solid #22c55e' : '1px solid #475569',
                    backgroundColor: selectedTruck === '13T' ? '#14532d' : '#0f172a',
                    textAlign: 'center'
                  }}
                >
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px' }}>Eicher 6-Wheeler</p>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>13 Tons Capacity</span>
                </div>
              </div>

              <form onSubmit={handleBooking} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Dynamic Live Search for Pickup Place */}
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Pickup Location (Any Village / Town / City in India):
                  </label>
                  <input
                    required
                    placeholder="Type village/town name (e.g., Birur, Peenya, Manchar, Kengeri)..."
                    value={pickup}
                    onChange={(e) => {
                      setPickup(e.target.value);
                      searchIndiaLocations(e.target.value, 'pickup');
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
                  />
                  {isSearchingPickup && <span style={{ position: 'absolute', right: '12px', top: '34px', fontSize: '11px', color: '#38bdf8' }}>Searching...</span>}
                  
                  {pickupSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', marginTop: '4px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                      {pickupSuggestions.map((item) => (
                        <div
                          key={item.place_id}
                          onClick={() => {
                            setPickup(item.display_name);
                            setPickupCoords(`${parseFloat(item.lat).toFixed(4)}° N, ${parseFloat(item.lon).toFixed(4)}° E`);
                            setPickupSuggestions([]);
                          }}
                          style={{ padding: '8px 12px', borderBottom: '1px solid #334155', fontSize: '12px', cursor: 'pointer', color: '#cbd5e1' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
                        >
                          📍 {item.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dynamic Live Search for Drop Place */}
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Drop Location (Any Village / Town / City in India):
                  </label>
                  <input
                    required
                    placeholder="Type destination village or city (e.g., Kadur, Udupi, Surat, Bhiwandi)..."
                    value={drop}
                    onChange={(e) => {
                      setDrop(e.target.value);
                      searchIndiaLocations(e.target.value, 'drop');
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
                  />
                  {isSearchingDrop && <span style={{ position: 'absolute', right: '12px', top: '34px', fontSize: '11px', color: '#38bdf8' }}>Searching...</span>}

                  {dropSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', marginTop: '4px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                      {dropSuggestions.map((item) => (
                        <div
                          key={item.place_id}
                          onClick={() => {
                            setDrop(item.display_name);
                            setDropCoords(`${parseFloat(item.lat).toFixed(4)}° N, ${parseFloat(item.lon).toFixed(4)}° E`);
                            setDropSuggestions([]);
                          }}
                          style={{ padding: '8px 12px', borderBottom: '1px solid #334155', fontSize: '12px', cursor: 'pointer', color: '#cbd5e1' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
                        >
                          📍 {item.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  required
                  type="number"
                  step="0.1"
                  placeholder="Cargo Weight in Tons (e.g., 2.5)"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
                />

                <input
                  required
                  placeholder="Type of Goods (e.g., Agricultural Produce, Pipes, Steel, FMCG)"
                  value={goods}
                  onChange={(e) => setGoods(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
                />

                <button
                  type="submit"
                  style={{ padding: '12px', backgroundColor: '#22c55e', color: '#052e16', fontWeight: '700', borderRadius: '6px', border: 'none', cursor: 'pointer', marginTop: '6px' }}
                >
                  Confirm & Save to Server
                </button>
              </form>

              {recentBooking && (
                <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#064e3b', borderRadius: '8px', border: '1px solid #059669' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#6ee7b7' }}>✓ Freight Request Registered!</p>
                  <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>Tracking Code: <strong style={{ color: '#fff' }}>{recentBooking.code}</strong></p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#fde047', fontWeight: '700' }}>
                    ⏰ Booked On: {recentBooking.bookingTimestamp}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#a7f3d0' }}>
                    Route: {recentBooking.pickup} ➔ {recentBooking.drop}
                  </p>
                </div>
              )}
            </div>

            {/* Tracking Search Card */}
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '18px', color: '#38bdf8', marginTop: 0 }}>Live Consignment Tracker</h2>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: 0 }}>Search by tracking code to view real-time trip status and booking timestamps.</p>
              
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input
                  placeholder="e.g., ZRL-74821"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', textTransform: 'uppercase' }}
                />
                <button
                  type="submit"
                  style={{ padding: '10px 18px', backgroundColor: '#38bdf8', color: '#082f49', fontWeight: '700', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                >
                  Track
                </button>
              </form>

              {searchResult === 'NOT_FOUND' && (
                <div style={{ marginTop: '20px', padding: '14px', backgroundColor: '#450a0a', borderRadius: '8px', border: '1px solid #991b1b', fontSize: '13px', color: '#fca5a5' }}>
                  No consignment found with this Tracking ID.
                </div>
              )}

              {searchResult && searchResult !== 'NOT_FOUND' && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#0c4a6e', borderRadius: '8px', border: '1px solid #0284c7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '700', color: '#38bdf8' }}>{searchResult.code}</span>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#0284c7', color: '#fff', fontWeight: '700' }}>
                      {searchResult.status}
                    </span>
                  </div>
                  
                  <div style={{ backgroundColor: '#082f49', padding: '8px 10px', borderRadius: '6px', margin: '8px 0' }}>
                    <span style={{ fontSize: '12px', color: '#fde047', fontWeight: '700' }}>
                      📅 Date & Time Booked: {searchResult.bookingTimestamp}
                    </span>
                  </div>

                  <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>From:</strong> {searchResult.pickup}</p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>To:</strong> {searchResult.drop}</p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Vehicle:</strong> {searchResult.truck} ({searchResult.weight} Tons)</p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Cargo:</strong> {searchResult.goods}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DRIVER TAB */}
        {activeTab === 'driver' && (
          <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#f8fafc' }}>🚚 Driver Trip & Navigation Access</h2>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#94a3b8' }}>Locations locked until Owner (Mohammed Huzaifa) provides the trip OTP.</p>

              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Assigned Consignment:</label>
              <select
                value={selectedTripId}
                onChange={(e) => {
                  setSelectedTripId(e.target.value);
                  setIsLocationGranted(false);
                  setDriverInputOtp('');
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569' }}
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.truck} ({b.goods}) • [{b.bookingTimestamp}]
                  </option>
                ))}
              </select>

              {!isLocationGranted ? (
                <div style={{ backgroundColor: '#0f172a', padding: '24px', borderRadius: '10px', border: '1px dashed #475569', textAlign: 'center', marginTop: '20px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#fbbf24' }}>Location Coordinates Protected</h3>
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
                    Enter the 4-digit OTP from Owner for <strong>{activeDriverTrip?.code || 'your assignment'}</strong>.
                  </p>

                  <form onSubmit={handleDriverOtpVerification} style={{ display: 'flex', justifyContent: 'center', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="4-Digit OTP"
                      value={driverInputOtp}
                      onChange={(e) => {
                        setDriverInputOtp(e.target.value);
                        setOtpError(false);
                      }}
                      style={{
                        padding: '10px',
                        width: '130px',
                        borderRadius: '6px',
                        border: otpError ? '1px solid #ef4444' : '1px solid #475569',
                        backgroundColor: '#1e293b',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: '16px',
                        letterSpacing: '3px'
                      }}
                    />
                    <button
                      type="submit"
                      style={{ padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', fontWeight: '700', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                    >
                      Unlock Route
                    </button>
                  </form>
                  {otpError && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '10px' }}>Invalid OTP for this trip.</p>}
                </div>
              ) : (
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700' }}>🟢 PICKUP LOCATION</span>
                      <p style={{ margin: '6px 0 2px 0', fontSize: '13px', fontWeight: '700' }}>{activeDriverTrip?.pickup || 'N/A'}</p>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>GPS: {activeDriverTrip?.pickupCoordinates || 'N/A'}</span>
                    </div>
                    <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <span style={{ fontSize: '11px', color: '#f87171', fontWeight: '700' }}>🔴 DESTINATION</span>
                      <p style={{ margin: '6px 0 2px 0', fontSize: '13px', fontWeight: '700' }}>{activeDriverTrip?.drop || 'N/A'}</p>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>GPS: {activeDriverTrip?.dropCoordinates || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OWNER TAB */}
        {activeTab === 'owner' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>FLEET OWNER</span>
                <h2 style={{ fontSize: '20px', margin: '2px 0 0 0', color: '#38bdf8' }}>{OWNER_NAME}</h2>
              </div>
              <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '20px', backgroundColor: '#14532d', color: '#4ade80', fontWeight: '700' }}>
                ✓ Authenticated Session
              </span>
            </div>

            <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '18px', color: '#38bdf8', margin: '0 0 16px 0' }}>All Consignments & Booking Timestamps ({bookings.length})</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8' }}>
                      <th style={{ padding: '10px 12px' }}>Code</th>
                      <th style={{ padding: '10px 12px' }}>Date & Time Booked</th>
                      <th style={{ padding: '10px 12px' }}>Pickup ➔ Drop</th>
                      <th style={{ padding: '10px 12px' }}>Truck & Cargo</th>
                      <th style={{ padding: '10px 12px' }}>Driver Unlock OTP</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Update Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#38bdf8' }}>{booking.code}</td>
                        <td style={{ padding: '12px', color: '#fde047', fontWeight: '600' }}>
                          📅 {booking.bookingTimestamp}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ maxWidth: '280px', wordBreak: 'break-word' }}><strong>From:</strong> {booking.pickup}</div>
                          <div style={{ maxWidth: '280px', wordBreak: 'break-word', marginTop: '4px' }}><strong>To:</strong> {booking.drop}</div>
                        </td>
                        <td style={{ padding: '12px' }}>{booking.truck} ({booking.weight}T)</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ backgroundColor: '#0f172a', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fbbf24', color: '#fbbf24', fontWeight: '800' }}>
                            {booking.driverOtp}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', backgroundColor: booking.status === 'DELIVERED' ? '#14532d' : '#0c4a6e', color: '#fff' }}>
                            {booking.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <select
                            value={booking.status}
                            onChange={(e) => updateBookingStatus(booking.id, e.target.value as BookingRecord['status'])}
                            style={{ backgroundColor: '#0f172a', color: '#fff', border: '1px solid #475569', padding: '6px 8px', borderRadius: '6px', fontSize: '12px' }}
                          >
                            <option value="ACCEPTED">ACCEPTED</option>
                            <option value="IN_TRANSIT">IN_TRANSIT</option>
                            <option value="DELIVERED">DELIVERED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Password Modal */}
      {showPassModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#1e293b', padding: '28px', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '380px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#f8fafc' }}>Owner Portal Access</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>Restricted to Fleet Owner: <strong style={{ color: '#38bdf8' }}>{OWNER_NAME}</strong></p>
            <form onSubmit={handlePassSubmit}>
              <input
                type="password"
                placeholder="Enter Owner Password"
                value={enteredPass}
                onChange={(e) => {
                  setEnteredPass(e.target.value);
                  setPassError(false);
                }}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: passError ? '1px solid #ef4444' : '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', textAlign: 'center', fontSize: '15px', boxSizing: 'border-box' }}
              />
              {passError && <p style={{ color: '#ef4444', fontSize: '12px', margin: '8px 0 0 0' }}>Invalid Password.</p>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowPassModal(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#16a34a', color: '#fff', fontWeight: '700', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Authorize</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}