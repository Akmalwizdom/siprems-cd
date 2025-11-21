import { useState } from 'react';
import { Save, Building, Clock } from 'lucide-react';

interface OpeningHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function Settings() {
  const [storeName, setStoreName] = useState('Admin Store');
  const [storeAddress, setStoreAddress] = useState('123 Main Street, City, State 12345');
  const [openingHours, setOpeningHours] = useState<OpeningHours>({
    Monday: { open: '09:00', close: '18:00', closed: false },
    Tuesday: { open: '09:00', close: '18:00', closed: false },
    Wednesday: { open: '09:00', close: '18:00', closed: false },
    Thursday: { open: '09:00', close: '18:00', closed: false },
    Friday: { open: '09:00', close: '18:00', closed: false },
    Saturday: { open: '10:00', close: '16:00', closed: false },
    Sunday: { open: '10:00', close: '16:00', closed: true },
  });

  const handleSave = () => {
    alert('Settings saved successfully!');
  };

  const updateHours = (day: string, field: 'open' | 'close', value: string) => {
    setOpeningHours({
      ...openingHours,
      [day]: { ...openingHours[day], [field]: value },
    });
  };

  const toggleClosed = (day: string) => {
    setOpeningHours({
      ...openingHours,
      [day]: { ...openingHours[day], closed: !openingHours[day].closed },
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-900 mb-1">Settings</h1>
          <p className="text-slate-500">Manage your store configuration</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>

      {/* Store Profile */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-100 rounded-lg">
            <Building className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-slate-900">Store Profile</h2>
            <p className="text-slate-500">Basic information about your store</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-700 mb-2">Store Name</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter store name"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-2">Store Address</label>
            <textarea
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="Enter store address"
            ></textarea>
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-slate-900">Operating Hours</h2>
            <p className="text-slate-500">Set your store's opening and closing times</p>
          </div>
        </div>

        <div className="space-y-3">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="w-32">
                <span className="text-slate-900">{day}</span>
              </div>

              {openingHours[day].closed ? (
                <div className="flex-1 text-slate-500">Closed</div>
              ) : (
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="time"
                    value={openingHours[day].open}
                    onChange={(e) => updateHours(day, 'open', e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="time"
                    value={openingHours[day].close}
                    onChange={(e) => updateHours(day, 'close', e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openingHours[day].closed}
                  onChange={() => toggleClosed(day)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="text-slate-600">Closed</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Settings Sections (Optional) */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <h2 className="mb-2">Need More Features?</h2>
        <p className="mb-4 text-indigo-100">
          Upgrade to Pro to unlock advanced settings, multi-store management, and detailed analytics.
        </p>
        <button className="bg-white text-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-50 transition-colors">
          Upgrade Now
        </button>
      </div>
    </div>
  );
}