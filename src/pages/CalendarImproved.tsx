import { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, 
  Tag, AlertCircle, Loader2, Sparkles, CheckCircle, XCircle, Edit3, 
  TrendingUp, Clock, History, AlertTriangle, Trash2
} from 'lucide-react';
import { useStore, type CalendarEvent } from '../context/StoreContext';

const API_BASE_URL = 'http://localhost:8000/api';

type ViewMode = 'month' | 'week' | 'day';

interface AISuggestion {
  suggested_category: string;
  suggested_impact: number;
  confidence: number;
  rationale: string;
  warning: boolean;
  warning_message?: string;
  requires_confirmation: boolean;
}

interface CalibrationHistory {
  calibration_date: string;
  previous_impact: number;
  new_impact: number;
  actual_sales: number;
  baseline_sales: number;
  observed_effect: number;
  method: string;
}

const eventTypeConfig: Record<string, {
  color: string;
  label: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
}> = {
  promotion: { 
    color: 'bg-blue-500', 
    label: 'Promotion', 
    bgLight: 'bg-blue-50', 
    textColor: 'text-blue-700', 
    borderColor: 'border-blue-200' 
  },
  holiday: { 
    color: 'bg-purple-500', 
    label: 'Holiday', 
    bgLight: 'bg-purple-50', 
    textColor: 'text-purple-700', 
    borderColor: 'border-purple-200' 
  },
  'store-closed': { 
    color: 'bg-red-500', 
    label: 'Store Closed', 
    bgLight: 'bg-red-50', 
    textColor: 'text-red-700', 
    borderColor: 'border-red-200' 
  },
  event: { 
    color: 'bg-green-500', 
    label: 'Event', 
    bgLight: 'bg-green-50', 
    textColor: 'text-green-700', 
    borderColor: 'border-green-200' 
  },
};

// Helper function to safely get event config
const getEventConfig = (eventType: string | undefined) => {
  if (!eventType) return eventTypeConfig['event']; // Default fallback
  return eventTypeConfig[eventType] || eventTypeConfig['event'];
};

export function CalendarImproved() {
  const { events, addEvent, removeEvent, refetchEvents } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [calibrationHistory, setCalibrationHistory] = useState<CalibrationHistory[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'promotion' as CalendarEvent['type'],
    description: '',
    impact: null as number | null,
  });
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [userDecision, setUserDecision] = useState<'accepted' | 'edited' | 'rejected' | null>(null);

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

  /**
   * OPEN NEW EVENT MODAL
   * - Clear all previous state
   * - Set selected date
   * - Open modal in CREATE mode
   */
  const handleDateClick = (date: Date) => {
    // Atomic state reset for new event
    setIsEditMode(false);
    setEditingEventId(null);
    setSelectedDate(date);
    setFormData({
      title: '',
      type: 'promotion',
      description: '',
      impact: null,
    });
    setAiSuggestion(null);
    setUserDecision(null);
    setIsLoadingAI(false);
    setShowModal(true);
  };

  /**
   * OPEN EDIT EVENT MODAL
   * - Load existing event data
   * - Open modal in EDIT mode
   * - Clear AI suggestion (editing existing event)
   */
  const handleEditEvent = (event: any) => {
    // Atomic state setup for edit mode
    setIsEditMode(true);
    setEditingEventId(event.id);
    setSelectedDate(new Date(event.date));
    setFormData({
      title: event.title || '',
      type: event.type || 'promotion',
      description: event.description || '',
      impact: event.impact_weight || event.impact || null,
    });
    setAiSuggestion(null);
    setUserDecision(null);
    setIsLoadingAI(false);
    setShowModal(true);
  };

  const requestAISuggestion = async () => {
    if (!formData.title) return;

    setIsLoadingAI(true);
    try {
      const response = await fetch(`${API_BASE_URL}/events/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          user_selected_type: formData.type,
          description: formData.description,
          date: selectedDate?.toISOString().split('T')[0],
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setAiSuggestion(data.suggestion);
      }
    } catch (error) {
      console.error('AI suggestion error:', error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  useEffect(() => {
    if (formData.title.length > 3 && showModal && !aiSuggestion) {
      // Debounce AI suggestion
      const timer = setTimeout(() => {
        requestAISuggestion();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData.title, formData.type]);

  /**
   * ACCEPT: User accepts AI suggestion
   * - Apply AI-suggested category & impact to form
   * - Proceed to confirmation modal
   * - User must still confirm before saving to backend
   */
  const handleAcceptSuggestion = () => {
    if (!aiSuggestion) return;
    
    // Atomic state update: Apply all AI suggestions at once
    setFormData(prev => ({
      ...prev,
      type: aiSuggestion.suggested_category as CalendarEvent['type'],
      impact: aiSuggestion.suggested_impact,
    }));
    setUserDecision('accepted');
    setShowConfirmModal(true);
  };

  /**
   * EDIT: User wants to modify AI suggestion
   * - Hide AI suggestion box
   * - Keep current form values
   * - Allow user to modify any field
   * - User will click "Continue" to proceed
   */
  const handleEditSuggestion = () => {
    // Atomic state update: Clear AI suggestion, set decision
    setAiSuggestion(null);
    setUserDecision('edited');
    // Note: Form stays open, user can now modify fields
  };

  /**
   * REJECT: User rejects AI suggestion
   * - Close all modals immediately
   * - Clear ALL temporary state
   * - NO backend call
   * - NO event created
   * - This is a COMPLETE CANCELLATION
   */
  const handleRejectSuggestion = (e?: React.MouseEvent) => {
    // CRITICAL: Prevent any event propagation or default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // CRITICAL: Stop any pending AI requests
    setIsLoadingAI(false);
    
    // CRITICAL: Clear AI suggestion immediately
    setAiSuggestion(null);
    setUserDecision(null);
    
    // CRITICAL: Clear form data immediately (before closeModal)
    setFormData({ title: '', type: 'promotion', description: '', impact: null });
    
    // CRITICAL: Close modal (will also clear state but we did it above to be certain)
    closeModal();
    
    console.log('[REJECT] All state cleared, no backend call made');
  };

  /**
   * CONFIRM EVENT: Final step - save to backend
   * - Only called from confirmation modal
   * - Performs actual backend API call
   * - On success: refetch events from backend (single source of truth)
   * - On failure: show error, keep modal open for retry
   * 
   * IMPORTANT: This is the ONLY place where events are saved to backend
   */
  const handleConfirmEvent = async () => {
    // Validation
    if (!selectedDate || !formData.title) {
      alert('Please fill in required fields (date and title)');
      return;
    }

    try {
      let response;
      
      if (isEditMode && editingEventId) {
        // UPDATE existing event
        response = await fetch(`${API_BASE_URL}/events/${editingEventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate.toISOString().split('T')[0],
            title: formData.title,
            type: formData.type,
            impact_weight: formData.impact || 0.5,
            description: formData.description,
            user_decision: userDecision || 'edited',
            ai_suggestion: aiSuggestion,
          }),
        });
      } else {
        // CREATE new event
        response = await fetch(`${API_BASE_URL}/events/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: selectedDate.toISOString().split('T')[0],
            title: formData.title,
            type: formData.type,
            impact_weight: formData.impact || 0.5,
            description: formData.description,
            user_decision: userDecision,
            ai_suggestion: aiSuggestion,
          }),
        });
      }

      const data = await response.json();
      if (data.status === 'success') {
        // SUCCESS: Atomic operation
        // 1. Refetch all events from backend (single source of truth)
        await refetchEvents();
        // 2. Close modal and clear all temporary state
        closeModal();
      } else {
        console.error(`Event ${isEditMode ? 'update' : 'creation'} failed:`, data);
        alert(`Failed to ${isEditMode ? 'update' : 'create'} event. Please try again.`);
        // Note: Modal stays open so user can retry
      }
    } catch (error) {
      console.error(`Event ${isEditMode ? 'update' : 'creation'} error:`, error);
      alert(`Error ${isEditMode ? 'updating' : 'creating'} event. Please check your connection and try again.`);
      // Note: Modal stays open so user can retry
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/events/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refetch events from database
        await refetchEvents();
      } else {
        const data = await response.json();
        alert(data.detail || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };

  const handleViewHistory = async (event: any) => {
    if (!event.id) return;
    
    setSelectedEvent(event);
    setShowHistoryModal(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/events/${event.id}/history`);
      const data = await response.json();
      if (data.status === 'success') {
        setCalibrationHistory(data.history);
      }
    } catch (error) {
      console.error('Error fetching calibration history:', error);
    }
  };

  const handleCalibrateEvent = async (eventId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/calibrate`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert(`Calibration successful! New impact: ${data.calibration.new_impact.toFixed(3)}`);
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Calibration error:', error);
    }
  };

  /**
   * CLOSE MODAL: Clean state reset
   * - Close all modals
   * - Clear all temporary state
   * - Reset form to defaults
   * - This is called on successful save or user cancellation
   */
  const closeModal = () => {
    console.log('[CLOSE MODAL] Clearing all state');
    
    // Atomic state reset: Clear everything at once
    setShowModal(false);
    setShowConfirmModal(false);
    setShowHistoryModal(false);
    setIsEditMode(false);
    setEditingEventId(null);
    setSelectedDate(null);
    setSelectedEvent(null);
    setFormData({ title: '', type: 'promotion', description: '', impact: null });
    setAiSuggestion(null);
    setUserDecision(null);
    setIsLoadingAI(false);
    setCalibrationHistory([]);
    
    console.log('[CLOSE MODAL] State cleared successfully');
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
            {dateEvents.map((event: any) => (
              <div
                key={event.id}
                className={`${getEventConfig(event.type).color} text-white px-2 py-1 rounded text-xs relative group`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="flex-1 truncate" onClick={(e) => {
                    e.stopPropagation();
                    handleEditEvent(event);
                  }}>{event.title}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvent(event);
                      }}
                      className="p-1 bg-white/90 hover:bg-white rounded shadow-sm"
                      title="Edit event"
                    >
                      <Edit3 className="w-3 h-3 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="p-1 bg-white/90 hover:bg-white rounded shadow-sm"
                      title="Delete event"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                    {event.calibrated_impact && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewHistory(event);
                        }}
                        className="p-1 bg-white/90 hover:bg-white rounded shadow-sm"
                        title="View history"
                      >
                        <History className="w-3 h-3 text-gray-600" />
                      </button>
                    )}
                  </div>
                  {event.ai_confidence && (
                    <Sparkles className="w-3 h-3 opacity-75" />
                  )}
                </div>
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
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Use handleDateClick to ensure clean state
              handleDateClick(new Date());
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
        <div className="flex items-center gap-2 ml-auto">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-slate-700 text-sm">AI Suggested</span>
        </div>
      </div>

      {/* Calendar View */}
      {renderMonthView()}

      {/* Add Event Modal with AI Suggestions */}
      {showModal && !showConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Prevent clicks on overlay from propagating
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              closeModal();
            }
          }}
        >
          <div 
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-slate-900">{isEditMode ? 'Edit Event' : 'Add Event'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
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

              {isLoadingAI && (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-3 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AI is analyzing your event...</span>
                </div>
              )}

              {aiSuggestion && (
                <div className={`p-4 rounded-lg border-2 ${aiSuggestion.warning ? 'bg-yellow-50 border-yellow-300' : 'bg-indigo-50 border-indigo-300'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <Sparkles className={`w-5 h-5 ${aiSuggestion.warning ? 'text-yellow-600' : 'text-indigo-600'} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <h3 className={`font-medium ${aiSuggestion.warning ? 'text-yellow-900' : 'text-indigo-900'} mb-1`}>
                        AI Suggestion {aiSuggestion.warning && '⚠️'}
                      </h3>
                      <p className="text-sm text-slate-700 mb-2">{aiSuggestion.rationale}</p>
                      {aiSuggestion.warning_message && (
                        <div className="flex items-start gap-2 bg-yellow-100 border border-yellow-300 rounded px-3 py-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-yellow-700 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-900">{aiSuggestion.warning_message}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Category: </span>
                          <span className={`font-medium px-2 py-1 rounded ${getEventConfig(aiSuggestion.suggested_category).bgLight} ${getEventConfig(aiSuggestion.suggested_category).textColor}`}>
                            {getEventConfig(aiSuggestion.suggested_category).label}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600">Impact: </span>
                          <span className="font-medium">{aiSuggestion.suggested_impact.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Confidence: </span>
                          <span className={`font-medium ${aiSuggestion.confidence >= 0.8 ? 'text-green-600' : aiSuggestion.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {(aiSuggestion.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAcceptSuggestion();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md font-medium"
                      title="Use AI-suggested category & impact"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-base">Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEditSuggestion();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium"
                      title="Modify event before saving"
                    >
                      <Edit3 className="w-5 h-5" />
                      <span className="text-base">Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRejectSuggestion(e);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors shadow-md font-medium"
                      title="Cancel without saving"
                    >
                      <XCircle className="w-5 h-5" />
                      <span className="text-base">Reject</span>
                    </button>
                  </div>
                </div>
              )}

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
                  <option value="event">Event</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Impact Weight (optional)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.impact || ''}
                  onChange={(e) => setFormData({ ...formData, impact: parseFloat(e.target.value) || null })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.0 - 2.0 (leave blank for AI suggestion)"
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

              {!aiSuggestion && !isLoadingAI && (
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // User chose to continue without AI suggestion or after editing
                      if (!formData.title) {
                        alert('Please enter an event title');
                        return;
                      }
                      setShowConfirmModal(true);
                    }}
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!formData.title}
                  >
                    Continue
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-slate-900">Confirm Event</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">You are creating:</p>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div><span className="font-medium">Title:</span> {formData.title}</div>
                  <div><span className="font-medium">Type:</span> {getEventConfig(formData.type).label}</div>
                  <div><span className="font-medium">Impact:</span> {formData.impact?.toFixed(2) || 'Default'}</div>
                  <div><span className="font-medium">Decision:</span> {userDecision?.toUpperCase()}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmEvent}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calibration History Modal */}
      {showHistoryModal && selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-slate-900">Event Intelligence</h2>
                <p className="text-sm text-slate-500">{selectedEvent.title}</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Current Status */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="font-medium text-indigo-900 mb-3">Current Status</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Category:</span>
                    <span className="ml-2 font-medium">{getEventConfig(selectedEvent.type).label}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Impact Weight:</span>
                    <span className="ml-2 font-medium">{(selectedEvent.calibrated_impact || selectedEvent.impact_weight || 0).toFixed(3)}</span>
                  </div>
                  {selectedEvent.ai_confidence && (
                    <div>
                      <span className="text-slate-600">AI Confidence:</span>
                      <span className="ml-2 font-medium">{(selectedEvent.ai_confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {selectedEvent.last_calibration_date && (
                    <div>
                      <span className="text-slate-600">Last Calibrated:</span>
                      <span className="ml-2 font-medium">{new Date(selectedEvent.last_calibration_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                {selectedEvent.ai_rationale && (
                  <div className="mt-3 pt-3 border-t border-indigo-200">
                    <span className="text-slate-600 text-sm">AI Rationale:</span>
                    <p className="text-sm text-slate-700 mt-1">{selectedEvent.ai_rationale}</p>
                  </div>
                )}
              </div>

              {/* Calibration History */}
              {calibrationHistory.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-3">Calibration History</h3>
                  <div className="space-y-3">
                    {calibrationHistory.map((cal, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">
                            {new Date(cal.calibration_date).toLocaleDateString()}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${cal.new_impact > cal.previous_impact ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cal.new_impact > cal.previous_impact ? '↑' : '↓'} {((cal.new_impact - cal.previous_impact) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500">Actual Sales:</span>
                            <div className="font-medium">${cal.actual_sales.toFixed(0)}</div>
                          </div>
                          <div>
                            <span className="text-slate-500">Baseline:</span>
                            <div className="font-medium">${cal.baseline_sales.toFixed(0)}</div>
                          </div>
                          <div>
                            <span className="text-slate-500">Effect:</span>
                            <div className="font-medium">{(cal.observed_effect * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {new Date(selectedEvent.date) < new Date() && (
                  <button
                    onClick={() => handleCalibrateEvent(selectedEvent.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Re-calibrate Impact
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
