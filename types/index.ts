export interface Device {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: Date;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  eventDates: string[]; // Array of ISO date strings
  slotDuration: number; // Duration in minutes
  availableSlots: string[]; // Array of time strings (e.g., ["09:00", "10:00", "11:00"])
  deviceIds: string[]; // Array of device IDs attached to this event
  createdAt: Date;
  companyLogo?: string;
  enabled?: boolean; // Whether the event is enabled for bookings (default: true)
}

export interface Booking {
  id: string;
  eventId: string;
  deviceId: string; // Device ID for this booking
  slotTime: string; // Time string (e.g., "09:00")
  date: string; // ISO date string
  name: string;
  email: string;
  phone: string;
  note?: string;
  createdAt: Date;
}

export interface EventWithBookings extends Event {
  bookings: Booking[];
}
