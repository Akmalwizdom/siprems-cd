import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed' | 'event';
  description?: string;
  impact?: number;
  category?: string;
}

interface StoreContextType {
  events: CalendarEvent[];
  addEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  clearEvents: () => void;
  refetchEvents: () => Promise<void>;
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/calendar/events`);
      const data = await response.json();
      const formattedEvents = data.map((e: any) => ({
        id: e.id ? String(e.id) : `temp_${Date.now()}_${Math.random()}`,
        title: e.title,
        date: e.date,
        type: (e.type as CalendarEvent['type']) || 'promotion',
        description: e.description || '',
        impact: e.impact_weight ?? e.impact ?? 0.3,
        category: e.category
      }));
      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEvent = (event: CalendarEvent) => {
    setEvents([...events, event]);
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const updateEvent = (id: string, updatedFields: Partial<CalendarEvent>) => {
    setEvents(
      events.map((e) =>
        e.id === id ? { ...e, ...updatedFields } : e
      )
    );
  };

  const clearEvents = () => {
    setEvents([]);
  };

  const refetchEvents = async () => {
    await fetchEvents();
  };

  return (
    <StoreContext.Provider value={{ events, addEvent, removeEvent, updateEvent, clearEvents, refetchEvents, loading }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
