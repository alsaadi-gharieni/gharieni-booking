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
import { Event, Booking, Device } from '@/types';

// Collections
export const eventsCollection = collection(db, 'events');
export const bookingsCollection = collection(db, 'bookings');
export const devicesCollection = collection(db, 'devices');

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
      deviceIds: data.deviceIds || [],
      location: data.location,
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
    deviceIds: data.deviceIds || [],
    location: data.location,
    enabled: data.enabled !== undefined ? data.enabled : true,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as Event;
}

// Update an event
export async function updateEvent(eventId: string, eventData: Partial<Omit<Event, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'events', eventId);
  await updateDoc(docRef, eventData);
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
export async function getBookingsByEventId(eventId: string, deviceId?: string): Promise<Booking[]> {
  try {
    const conditions: any[] = [where('eventId', '==', eventId)];
    if (deviceId) {
      conditions.push(where('deviceId', '==', deviceId));
    }
    
    const q = query(bookingsCollection, ...conditions);
    const snapshot = await getDocs(q);
    
    const bookings = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        eventId: data.eventId,
        deviceId: data.deviceId,
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

// Get bookings for a specific date and time slot for a device
export async function getBookingBySlot(
  eventId: string, 
  date: string, 
  slotTime: string,
  deviceId?: string
): Promise<Booking | null> {
  const conditions: any[] = [
    where('eventId', '==', eventId),
    where('date', '==', date),
    where('slotTime', '==', slotTime)
  ];
  
  if (deviceId) {
    conditions.push(where('deviceId', '==', deviceId));
  }
  
  const q = query(bookingsCollection, ...conditions);
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const bookingDoc = snapshot.docs[0];
  const data = bookingDoc.data();
  return {
    id: bookingDoc.id,
    eventId: data.eventId,
    deviceId: data.deviceId,
    slotTime: data.slotTime,
    date: data.date,
    name: data.name,
    email: data.email,
    phone: data.phone,
    note: data.note,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as Booking;
}

// Check if a user (by email or phone) already has a booking at a specific date+slot for the event
export async function getBookingByUserAtSlot(
  eventId: string,
  date: string,
  slotTime: string,
  email?: string,
  phone?: string
): Promise<Booking | null> {
  try {
    // Check by email if provided
    if (email) {
      const emailQ = query(
        bookingsCollection,
        where('eventId', '==', eventId),
        where('date', '==', date),
        where('slotTime', '==', slotTime),
        where('email', '==', email.toLowerCase().trim())
      );
      const emailSnap = await getDocs(emailQ);
      if (!emailSnap.empty) {
        const bookingDoc = emailSnap.docs[0];
        const data = bookingDoc.data();
        return {
          id: bookingDoc.id,
          eventId: data.eventId,
          deviceId: data.deviceId,
          slotTime: data.slotTime,
          date: data.date,
          name: data.name,
          email: data.email,
          phone: data.phone,
          note: data.note,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Booking;
      }
    }

    // Check by phone if provided
    if (phone) {
      const phoneQ = query(
        bookingsCollection,
        where('eventId', '==', eventId),
        where('date', '==', date),
        where('slotTime', '==', slotTime),
        where('phone', '==', phone.trim())
      );
      const phoneSnap = await getDocs(phoneQ);
      if (!phoneSnap.empty) {
        const bookingDoc = phoneSnap.docs[0];
        const data = bookingDoc.data();
        return {
          id: bookingDoc.id,
          eventId: data.eventId,
          deviceId: data.deviceId,
          slotTime: data.slotTime,
          date: data.date,
          name: data.name,
          email: data.email,
          phone: data.phone,
          note: data.note,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Booking;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking user booking at slot:', error);
    throw error;
  }
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
    const data = bookingDoc.data();
    return {
      id: bookingDoc.id,
      eventId: data.eventId,
      deviceId: data.deviceId,
      slotTime: data.slotTime,
      date: data.date,
      name: data.name,
      email: data.email,
      phone: data.phone,
      note: data.note,
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
    const data = bookingDoc.data();
    return {
      id: bookingDoc.id,
      eventId: data.eventId,
      deviceId: data.deviceId,
      slotTime: data.slotTime,
      date: data.date,
      name: data.name,
      email: data.email,
      phone: data.phone,
      note: data.note,
      createdAt: bookingDoc.data().createdAt?.toDate() || new Date(),
    } as Booking;
  }
  
  return null;
}

// Device CRUD operations
export async function createDevice(deviceData: Omit<Device, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(devicesCollection, {
    ...deviceData,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getAllDevices(): Promise<Device[]> {
  const snapshot = await getDocs(query(devicesCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      link: data.link,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Device;
  });
}

export async function getDeviceById(deviceId: string): Promise<Device | null> {
  const docRef = doc(db, 'devices', deviceId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description,
    imageUrl: data.imageUrl,
    link: data.link,
    createdAt: data.createdAt?.toDate() || new Date(),
  } as Device;
}

export async function updateDevice(deviceId: string, deviceData: Partial<Omit<Device, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'devices', deviceId);
  
  // Filter out undefined values - Firestore doesn't accept undefined
  const cleanData: any = {};
  Object.keys(deviceData).forEach(key => {
    const value = (deviceData as any)[key];
    if (value !== undefined) {
      cleanData[key] = value;
    }
  });
  
  await updateDoc(docRef, cleanData);
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const docRef = doc(db, 'devices', deviceId);
  await deleteDoc(docRef);
}

export async function getDevicesByIds(deviceIds: string[]): Promise<Device[]> {
  if (deviceIds.length === 0) return [];
  
  const devices: Device[] = [];
  for (const deviceId of deviceIds) {
    const device = await getDeviceById(deviceId);
    if (device) {
      devices.push(device);
    }
  }
  return devices;
}
