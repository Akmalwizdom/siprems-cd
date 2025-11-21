import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, Tag, AlertCircle } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed';
  description?: string;
}

type ViewMode = 'month' | 'week' | 'day';

const eventTypeConfig = {
  promotion: { color: 'bg-blue-500', label: 'Promotion', bgLight: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  holiday: { color: 'bg-purple-500', label: 'Holiday', bgLight: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  'store-closed': { color: 'bg-red-500', label: 'Store Closed', bgLight: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
};

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'Black Friday Sale',
      date: '2024-11-29',
      type: 'promotion',
      description: '50% off on all electronics',
    },
    {
      id: '2',
      title: 'Christmas',
      date: '2024-12-25',
      type: 'holiday',
      description: 'Christmas Day',
    },
    {
      id: '3',
      title: 'Store Renovation',
      date: '2024-12-15',
      type: 'store-closed',
      description: 'Closed for renovation works',
    },
  ]);
  const [formData, setFormData] = useState({
    title: '',
    type: 'promotion' as CalendarEvent['type'],
    description: '',
  });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getWeekDays = (date: Date) => {
    const days = [];
    const current = new Date(date);
    const dayOfWeek = current.getDay();
    const diff = current.getDate() - dayOfWeek;
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(current);
      day.setDate(diff + i);
      days.push(day);
    }
    return days;
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    setCurrentDate(newDate);
  };

  const handleNavigate = (direction: number) => {
    if (viewMode === 'month') navigateMonth(direction);
    if (viewMode === 'week') navigateWeek(direction);
    if (viewMode === 'day') navigateDay(direction);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowModal(true);
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !formData.title) return;

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: formData.title,
      date: selectedDate.toISOString().split('T')[0],
      type: formData.type,
      description: formData.description,
    };

    setEvents([...events, newEvent]);
    closeModal();
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedDate(null);
    setFormData({ title: '', type: 'promotion', description: '' });
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => e.date === dateStr);
  };

  const formatHeader = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      return `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderMonthView = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="border border-slate-200 bg-slate-50 min-h-32"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateEvents = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(date)}
          className="border border-slate-200 bg-white p-2 min-h-32 hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full mb-2 ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-900'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {dateEvents.map((event) => (
              <div
                key={event.id}
                className={`${eventTypeConfig[event.type].color} text-white px-2 py-1 rounded text-xs truncate`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Could open event details modal here
                }}
              >
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 bg-slate-50 text-center text-slate-700 border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">{days}</div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-8 border-b border-slate-200">
          <div className="p-3 bg-slate-50"></div>
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={idx}
                className={`p-3 bg-slate-50 text-center border-l border-slate-200 ${isToday ? 'bg-indigo-50' : ''}`}
              >
                <div className="text-xs text-slate-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className={`text-slate-900 ${isToday ? 'text-indigo-600' : ''}`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-200">
              <div className="p-2 bg-slate-50 text-xs text-slate-500 text-right border-r border-slate-200">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {weekDays.map((day, idx) => {
                const dateEvents = getEventsForDate(day);
                return (
                  <div
                    key={idx}
                    onClick={() => handleDateClick(day)}
                    className="p-2 border-l border-slate-200 min-h-16 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    {hour === 9 && dateEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`${eventTypeConfig[event.type].color} text-white px-2 py-1 rounded text-xs mb-1`}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dateEvents = getEventsForDate(currentDate);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-slate-900">Schedule</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {hours.map((hour) => (
                <div key={hour} className="flex border-b border-slate-200">
                  <div className="w-20 p-3 bg-slate-50 text-slate-500 text-right border-r border-slate-200">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div
                    onClick={() => handleDateClick(currentDate)}
                    className="flex-1 p-3 min-h-16 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    {hour === 9 && dateEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`${eventTypeConfig[event.type].color} text-white px-3 py-2 rounded mb-2`}
                      >
                        <div>{event.title}</div>
                        {event.description && (
                          <div className="text-xs mt-1 opacity-90">{event.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-slate-900 mb-4">Events Today</h3>
            {dateEvents.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No events scheduled</p>
            ) : (
              <div className="space-y-3">
                {dateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border ${eventTypeConfig[event.type].bgLight} ${eventTypeConfig[event.type].borderColor}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className={`${eventTypeConfig[event.type].textColor}`}>{event.title}</h4>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${eventTypeConfig[event.type].bgLight} ${eventTypeConfig[event.type].textColor}`}>
                      {eventTypeConfig[event.type].label}
                    </span>
                    {event.description && (
                      <p className="text-xs text-slate-600 mt-2">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleDateClick(currentDate)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Event
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleNavigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-slate-900">{formatHeader()}</h1>
          <button
            onClick={() => handleNavigate(1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'week' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'day' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Day
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedDate(new Date());
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Event
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 bg-white rounded-lg border border-slate-200 p-4">
        {Object.entries(eventTypeConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${config.color}`}></div>
            <span className="text-slate-700">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Views */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}

      {/* Add Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-slate-900">Add Event</h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">Event Date</label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  {selectedDate?.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Event Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CalendarEvent['type'] })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="promotion">Promotion</option>
                  <option value="holiday">Holiday</option>
                  <option value="store-closed">Store Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 50% Off Sale"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                  placeholder="Additional details..."
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
