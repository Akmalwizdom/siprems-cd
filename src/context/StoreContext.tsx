import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'promotion' | 'holiday' | 'store-closed';
  description?: string;
}

interface StoreContextType {
  events: CalendarEvent[];
  addEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, event: Partial<CalendarEvent>) => void;
  clearEvents: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
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

  return (
    <StoreContext.Provider value={{ events, addEvent, removeEvent, updateEvent, clearEvents }}>
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
