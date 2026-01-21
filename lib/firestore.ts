import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where, 
  Timestamp,
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { Event, Booking } from '@/types';

// Events collection
export const eventsCollection = collection(db, 'events');
export const bookingsCollection = collection(db, 'bookings');

// Create a new event
export async function createEvent(eventData: Omit<Event, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(eventsCollection, {
    ...eventData,
    enabled: eventData.enabled !== undefined ? eventData.enabled : true,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Get all events
export async function getAllEvents(): Promise<Event[]> {
  const snapshot = await getDocs(query(eventsCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      enabled: data.enabled !== undefined ? data.enabled : true,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Event;
  });
}

// Get event by ID
export async function getEventById(eventId: string): Promise<Event | null> {
  const docRef = doc(db, 'events', eventId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    enabled: data.enabled !== undefined ? data.enabled : true,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as Event;
}

// Toggle event enabled/disabled status
export async function toggleEventEnabled(eventId: string, enabled: boolean): Promise<void> {
  const docRef = doc(db, 'events', eventId);
  await updateDoc(docRef, { enabled });
}

// Delete an event
export async function deleteEvent(eventId: string): Promise<void> {
  const docRef = doc(db, 'events', eventId);
  await deleteDoc(docRef);
}

// Delete a booking (cancel booking)
export async function deleteBooking(bookingId: string): Promise<void> {
  const docRef = doc(db, 'bookings', bookingId);
  await deleteDoc(docRef);
}

// Create a booking
export async function createBooking(bookingData: Omit<Booking, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(bookingsCollection, {
    ...bookingData,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

// Get bookings for an event
export async function getBookingsByEventId(eventId: string): Promise<Booking[]> {
  try {
    // Query without orderBy to avoid needing composite index
    const q = query(
      bookingsCollection, 
      where('eventId', '==', eventId)
    );
    const snapshot = await getDocs(q);
    
    const bookings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId,
        slotTime: data.slotTime,
        date: data.date,
        name: data.name,
        email: data.email,
        phone: data.phone,
        note: data.note,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Booking;
    });
    
    // Sort by date and slotTime client-side
    return bookings.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.slotTime.localeCompare(b.slotTime);
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }
}

// Get bookings for a specific date and time slot
export async function getBookingBySlot(
  eventId: string, 
  date: string, 
  slotTime: string
): Promise<Booking | null> {
  const q = query(
    bookingsCollection,
    where('eventId', '==', eventId),
    where('date', '==', date),
    where('slotTime', '==', slotTime)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const bookingDoc = snapshot.docs[0];
  return {
    id: bookingDoc.id,
    ...bookingDoc.data(),
    createdAt: bookingDoc.data().createdAt?.toDate() || new Date(),
  } as Booking;
}

// Check if email or phone already exists for this event
export async function checkExistingBooking(
  eventId: string,
  email: string,
  phone: string
): Promise<Booking | null> {
  // Check for existing booking with same email
  const emailQuery = query(
    bookingsCollection,
    where('eventId', '==', eventId),
    where('email', '==', email.toLowerCase().trim())
  );
  const emailSnapshot = await getDocs(emailQuery);
  
  if (!emailSnapshot.empty) {
    const bookingDoc = emailSnapshot.docs[0];
    return {
      id: bookingDoc.id,
      ...bookingDoc.data(),
      createdAt: bookingDoc.data().createdAt?.toDate() || new Date(),
    } as Booking;
  }
  
  // Check for existing booking with same phone
  const phoneQuery = query(
    bookingsCollection,
    where('eventId', '==', eventId),
    where('phone', '==', phone.trim())
  );
  const phoneSnapshot = await getDocs(phoneQuery);
  
  if (!phoneSnapshot.empty) {
    const bookingDoc = phoneSnapshot.docs[0];
    return {
      id: bookingDoc.id,
      ...bookingDoc.data(),
      createdAt: bookingDoc.data().createdAt?.toDate() || new Date(),
    } as Booking;
  }
  
  return null;
}
