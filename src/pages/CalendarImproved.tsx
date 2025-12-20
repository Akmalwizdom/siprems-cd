import { useState, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, 
  Tag, AlertCircle, Loader2, Sparkles, CheckCircle, XCircle, Edit3, 
  TrendingUp, Clock, History, AlertTriangle, Trash2
} from 'lucide-react';
import { useStore, type CalendarEvent } from '../context/StoreContext';
import { formatIDR } from '../utils/currency';
import { Button } from '../components/ui/button';
import { API_BASE_URL } from '../config';
import { AdminOnly } from '../components/auth/RoleGuard';
import { useToast } from '../components/ui/toast';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';

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
    label: 'Promosi', 
    bgLight: 'bg-blue-50', 
    textColor: 'text-blue-700', 
    borderColor: 'border-blue-200' 
  },
  holiday: { 
    color: 'bg-purple-500', 
    label: 'Hari Libur', 
    bgLight: 'bg-purple-50', 
    textColor: 'text-purple-700', 
    borderColor: 'border-purple-200' 
  },
  'store-closed': { 
    color: 'bg-red-500', 
    label: 'Toko Tutup', 
    bgLight: 'bg-red-50', 
    textColor: 'text-red-700', 
    borderColor: 'border-red-200' 
  },
  event: { 
    color: 'bg-green-500', 
    label: 'Acara', 
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
    impactDirection: 'increase' as 'increase' | 'decrease' | 'normal' | 'closed',
    impactIntensity: 50, // 0-100 percentage
  });
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [userDecision, setUserDecision] = useState<'accepted' | 'edited' | 'rejected' | null>(null);
  
  // Delete confirmation state
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  
  // Alert state for validation errors
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Toast hook
  const { showToast } = useToast();
  
  // National holidays state
  interface NationalHoliday {
    date: string;
    name: string;
    description: string;
    is_national_holiday: boolean;
  }
  const [nationalHolidays, setNationalHolidays] = useState<NationalHoliday[]>([]);
  
  // Fetch national holidays when year changes
  const currentYear = currentDate.getFullYear();
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        console.log(`[Holidays] Fetching holidays for year ${currentYear}`);
        const response = await fetch(`${API_BASE_URL}/holidays/${currentYear}`);
        const data = await response.json();
        console.log('[Holidays] API Response:', data);
        if (data.status === 'success') {
          setNationalHolidays(data.holidays);
          console.log(`[Holidays] Loaded ${data.holidays.length} holidays`);
        }
      } catch (error) {
        console.error('[Holidays] Failed to fetch holidays:', error);
      }
    };
    fetchHolidays();
  }, [currentYear]);

  // Helper function to calculate impact weight from direction and intensity
  const calculateImpactWeight = () => {
    switch (formData.impactDirection) {
      case 'increase':
        return 1 + (formData.impactIntensity / 100); // 1.0 - 2.0
      case 'decrease':
        return 1 - (formData.impactIntensity / 100); // 0.0 - 1.0
      case 'normal':
        return 1.0;
      case 'closed':
        return 0.0;
      default:
        return 1.0;
    }
  };

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
      impactDirection: 'increase',
      impactIntensity: 50,
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
      impactDirection: event.impact_weight > 1 ? 'increase' : event.impact_weight < 1 ? 'decrease' : event.impact_weight === 0 ? 'closed' : 'normal',
      impactIntensity: Math.abs((event.impact_weight || 1) - 1) * 100,
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
        // Auto-apply the AI-classified category to formData
        setFormData(prev => ({
          ...prev,
          type: data.suggestion.suggested_category as CalendarEvent['type'],
        }));
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
      // Debounce AI suggestion - wait 2.5 seconds after user stops typing
      const timer = setTimeout(() => {
        requestAISuggestion();
      }, 2500);
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
    setFormData({ title: '', type: 'promotion', description: '', impactDirection: 'increase', impactIntensity: 50 });
    
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
      setValidationError('Harap isi kolom yang diperlukan (tanggal dan judul)');
      setTimeout(() => setValidationError(null), 5000);
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
            impact_weight: calculateImpactWeight(),
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
            impact_weight: calculateImpactWeight(),
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
        showToast(`Gagal ${isEditMode ? 'memperbarui' : 'membuat'} acara. Silakan coba lagi.`, 'error');
        // Note: Modal stays open so user can retry
      }
    } catch (error) {
      console.error(`Event ${isEditMode ? 'update' : 'creation'} error:`, error);
      showToast(`Error ${isEditMode ? 'memperbarui' : 'membuat'} acara. Periksa koneksi Anda.`, 'error');
      // Note: Modal stays open so user can retry
    }
  };

  const handleDeleteClick = (id: string) => {
    setEventToDelete(id);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventToDelete}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Refetch events from database
        await refetchEvents();
        showToast('Acara berhasil dihapus', 'success');
      } else {
        const data = await response.json();
        showToast(data.detail || 'Gagal menghapus acara', 'error');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('Gagal menghapus acara. Silakan coba lagi.', 'error');
    } finally {
      setEventToDelete(null);
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
    setFormData({ title: '', type: 'promotion', description: '', impactDirection: 'increase', impactIntensity: 50 });
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

  // Get national holiday for a specific date
  const getHolidayForDate = (date: Date): NationalHoliday | undefined => {
    // Format date as YYYY-MM-DD without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return nationalHolidays.find(h => h.date === dateStr && h.is_national_holiday);
  };

  const formatHeader = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'week') {
      const weekDays = getWeekDays(currentDate);
      return `${weekDays[0].toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('id-ID', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
      const holiday = getHolidayForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      const isHoliday = !!holiday;

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(date)}
          className={`border p-2 min-h-32 cursor-pointer transition-colors ${
            isHoliday 
              ? 'bg-red-50 hover:bg-red-100 border-red-200' 
              : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
          title={isHoliday ? holiday?.name : undefined}
        >
          <div className="flex items-start justify-between mb-2 gap-1">
            <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${isToday ? 'bg-indigo-600 text-white' : isHoliday ? 'text-red-600 font-bold' : 'text-slate-900'}`}>
              {day}
            </div>
            {isHoliday && (
              <span className="text-[10px] leading-tight text-right text-red-600 font-medium pt-1">
                {holiday.name}
              </span>
            )}
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
                  <AdminOnly>
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
                          handleDeleteClick(event.id);
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
                  </AdminOnly>
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
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate(-1)}
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </Button>
          <h1 className="text-slate-900">{formatHeader()}</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate(1)}
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Hari Ini
          </Button>
        </div>

        <AdminOnly>
          <div className="flex items-center gap-3">
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDateClick(new Date());
              }}
              size="sm"
            >
              <Plus className="w-5 h-5" />
              Tambah Acara
            </Button>
          </div>
        </AdminOnly>
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
          <span className="text-slate-700 text-sm">Saran AI</span>
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
              <h2 className="text-slate-900">{isEditMode ? 'Edit Acara' : 'Tambah Acara'}</h2>
              <Button variant="ghost" size="icon-sm" onClick={closeModal}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-slate-700 mb-2">Tanggal Acara</label>
                <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                  {selectedDate?.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Judul Acara *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="contoh: Diskon 50%"
                />
              </div>

              {isLoadingAI && (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-3 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AI sedang menganalisis acara Anda...</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 mb-2">Kategori Acara</label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                  isLoadingAI ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50 border-indigo-200'
                }`}>
                  {isLoadingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="text-slate-600 text-sm">AI sedang mengklasifikasi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className={`font-medium px-3 py-1 rounded-full text-sm ${getEventConfig(formData.type).bgLight} ${getEventConfig(formData.type).textColor}`}>
                        {getEventConfig(formData.type).label}
                      </span>
                      <span className="text-xs text-slate-500">Diklasifikasi oleh AI</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-slate-700 mb-2">Dampak pada Penjualan</label>
                
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.impactDirection === 'increase' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="impactDirection"
                      value="increase"
                      checked={formData.impactDirection === 'increase'}
                      onChange={() => setFormData({ ...formData, impactDirection: 'increase' })}
                      className="sr-only"
                    />
                    <span className="text-green-600 text-lg">📈</span>
                    <span className="text-slate-700">Naik</span>
                  </label>
                  
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.impactDirection === 'decrease' 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="impactDirection"
                      value="decrease"
                      checked={formData.impactDirection === 'decrease'}
                      onChange={() => setFormData({ ...formData, impactDirection: 'decrease' })}
                      className="sr-only"
                    />
                    <span className="text-orange-600 text-lg">📉</span>
                    <span className="text-slate-700">Turun</span>
                  </label>
                  
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.impactDirection === 'normal' 
                      ? 'border-slate-500 bg-slate-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="impactDirection"
                      value="normal"
                      checked={formData.impactDirection === 'normal'}
                      onChange={() => setFormData({ ...formData, impactDirection: 'normal' })}
                      className="sr-only"
                    />
                    <span className="text-slate-600 text-lg">➖</span>
                    <span className="text-slate-700">Normal</span>
                  </label>
                  
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    formData.impactDirection === 'closed' 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="impactDirection"
                      value="closed"
                      checked={formData.impactDirection === 'closed'}
                      onChange={() => setFormData({ ...formData, impactDirection: 'closed' })}
                      className="sr-only"
                    />
                    <span className="text-red-600 text-lg">🚫</span>
                    <span className="text-slate-700">Tutup</span>
                  </label>
                </div>
                
                {(formData.impactDirection === 'increase' || formData.impactDirection === 'decrease') && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <span>Intensitas</span>
                      <span className="font-medium">{formData.impactIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={formData.impactIntensity}
                      onChange={(e) => setFormData({ ...formData, impactIntensity: parseInt(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>Sedikit</span>
                      <span>Sangat Besar</span>
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3 mt-2">
                  Dampak: <span className="font-medium text-indigo-600">{calculateImpactWeight().toFixed(2)}</span>
                  {formData.impactDirection === 'increase' && ` (+${formData.impactIntensity}% penjualan)`}
                  {formData.impactDirection === 'decrease' && ` (-${formData.impactIntensity}% penjualan)`}
                  {formData.impactDirection === 'normal' && ` (tidak ada perubahan)`}
                  {formData.impactDirection === 'closed' && ` (toko tutup)`}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-2">Deskripsi</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                  placeholder="Detail tambahan..."
                ></textarea>
              </div>

              {!aiSuggestion && !isLoadingAI && (
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!formData.title) {
                        alert('Silakan masukkan judul acara');
                        return;
                      }
                      setShowConfirmModal(true);
                    }}
                    disabled={!formData.title}
                    className="flex-1"
                  >
                    Lanjutkan
                  </Button>
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
              <h2 className="text-slate-900">Konfirmasi Acara</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Anda akan membuat:</p>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div><span className="font-medium">Judul:</span> {formData.title}</div>
                  <div><span className="font-medium">Jenis:</span> {getEventConfig(formData.type).label}</div>
                  <div><span className="font-medium">Dampak:</span> {calculateImpactWeight().toFixed(2)} ({formData.impactDirection})</div>
                  <div><span className="font-medium">Keputusan:</span> {userDecision?.toUpperCase()}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1"
                >
                  Kembali
                </Button>
                <Button onClick={handleConfirmEvent} className="flex-1">
                  Konfirmasi & Simpan
                </Button>
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
              <Button variant="ghost" size="icon-sm" onClick={closeModal}>
                <X className="w-5 h-5" />
              </Button>
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
                            <div className="font-medium">{formatIDR(cal.actual_sales)}</div>
                          </div>
                          <div>
                            <span className="text-slate-500">Baseline:</span>
                            <div className="font-medium">{formatIDR(cal.baseline_sales)}</div>
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
                  <Button
                    onClick={() => handleCalibrateEvent(selectedEvent.id)}
                    className="flex-1"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Re-calibrate Impact
                  </Button>
                )}
                <Button variant="outline" onClick={closeModal} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Dialog */}
      <ConfirmDialog
        open={!!eventToDelete}
        onOpenChange={(open) => !open && setEventToDelete(null)}
        title="Hapus Acara?"
        description="Apakah Anda yakin ingin menghapus acara ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />

      {/* Validation Error Alert */}
      {validationError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
