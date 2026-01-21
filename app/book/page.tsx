'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getEventById, getBookingBySlot, createBooking, checkExistingBooking } from '@/lib/firestore'
import { Event } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

function BookEventContent() {
  const searchParams = useSearchParams()
  // Get eventId from query parameter (e.g., /book?eventId=abc123)
  const eventId = searchParams?.get('eventId') || ''
  
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<Map<string, Set<string>>>(new Map())

  useEffect(() => {
    if (eventId) {
      loadEvent()
    }
  }, [eventId])

  const loadEvent = async () => {
    try {
      const eventData = await getEventById(eventId)
      if (!eventData) {
        toast.error('Event not found')
        return
      }
      setEvent(eventData)
      
      const bookedMap = new Map<string, Set<string>>()
      for (const date of eventData.eventDates) {
        const bookedForDate = new Set<string>()
        for (const slot of eventData.availableSlots) {
          const existingBooking = await getBookingBySlot(eventId, date, slot)
          if (existingBooking) {
            bookedForDate.add(slot)
          }
        }
        bookedMap.set(date, bookedForDate)
      }
      setBookedSlots(bookedMap)
    } catch (error) {
      console.error('Error loading event:', error)
      toast.error('Failed to load event')
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDate || !selectedSlot) {
      toast.error('Please select a date and time slot')
      return
    }

    if (!bookingForm.name || !bookingForm.email || !bookingForm.phone) {
      toast.error('Please fill in your name, email, and phone number')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(bookingForm.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    const phoneDigits = bookingForm.phone.replace(/\D/g, '')
    if (!phoneRegex.test(bookingForm.phone) || phoneDigits.length < 10) {
      toast.error('Please enter a valid phone number')
      return
    }

    setSubmitting(true)

    try {
      const existingBooking = await getBookingBySlot(eventId, selectedDate, selectedSlot)
      
      if (existingBooking) {
        toast.error('This slot has already been booked. Please select another time.')
        setSubmitting(false)
        return
      }

      const existingEmailOrPhone = await checkExistingBooking(
        eventId,
        bookingForm.email.trim(),
        bookingForm.phone.trim()
      )
      
      if (existingEmailOrPhone) {
        toast.error('A booking with this email or phone number already exists for this event.')
        setSubmitting(false)
        return
      }

      const bookingData: any = {
        eventId,
        slotTime: selectedSlot,
        date: selectedDate,
        name: bookingForm.name.trim(),
        email: bookingForm.email.toLowerCase().trim(),
        phone: bookingForm.phone.trim(),
      }
      
      if (bookingForm.note && bookingForm.note.trim() !== '') {
        bookingData.note = bookingForm.note.trim()
      }
      
      await createBooking(bookingData)

      toast.success('Booking confirmed!')
      await loadEvent()
      setSelectedSlot(null)
      setSelectedDate(null)
      setBookingForm({ name: '', email: '', phone: '', note: '' })
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error('Failed to create booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-800">Loading event...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-800">The event you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  if (event.enabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
          <p className="text-gray-800 mb-4">This event is currently disabled and not accepting new bookings.</p>
          <div className="mb-6 flex justify-center">
            {event.companyLogo ? (
              <img src={event.companyLogo} alt="Company Logo" className="h-20 object-contain" />
            ) : (
              <img src="/images/logo-dark.png" alt="Logo" className="h-20 object-contain" />
            )}
          </div>
        </div>
      </div>
    )
  }

  const getAvailableSlotsForDate = (date: string) => {
    const bookedForDate = bookedSlots.get(date) || new Set<string>()
    return event.availableSlots.filter(slot => !bookedForDate.has(slot))
  }

  const isSlotBooked = (date: string, slot: string) => {
    const bookedForDate = bookedSlots.get(date) || new Set<string>()
    return bookedForDate.has(slot)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="mb-6 flex justify-center">
            {event.companyLogo ? (
              <img src={event.companyLogo} alt="Company Logo" className="h-20 object-contain" />
            ) : (
              <img src="/images/logo-dark.png" alt="Logo" className="h-20 object-contain" />
            )}
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 text-center">
            {event.title}
          </h1>
          <p className="text-lg text-gray-800 mb-6 text-center">
            {event.description}
          </p>
          <div className="text-center text-gray-800">
            <p className="font-semibold mb-2">Available Dates:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {event.eventDates.map((date) => (
                <span
                  key={date}
                  className="px-3 py-1 bg-indigo-100 text-indigo-900 rounded-lg text-sm font-medium"
                >
                  {format(new Date(date), 'MMM dd, yyyy')}
                </span>
              ))}
            </div>
            <p className="text-sm mt-3 text-gray-700">
              Duration: {event.slotDuration} minutes per slot
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Book Your Slot</h2>
          
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-4">
              Select a Date *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {event.eventDates.map((date) => {
                const isSelected = selectedDate === date
                const availableSlotsForDate = getAvailableSlotsForDate(date)
                const hasAvailableSlots = availableSlotsForDate.length > 0
                
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!hasAvailableSlots}
                    onClick={() => {
                      setSelectedDate(date)
                      setSelectedSlot(null)
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      !hasAvailableSlots
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {format(new Date(date), 'EEEE, MMM dd, yyyy')}
                    </div>
                    <div className={`text-xs mt-1 ${isSelected ? 'text-indigo-100' : 'text-gray-800'}`}>
                      {hasAvailableSlots 
                        ? `${availableSlotsForDate.length} slots available`
                        : 'Fully booked'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-900 mb-4">
                Select a Time Slot for {format(new Date(selectedDate), 'MMM dd, yyyy')} *
              </label>
              {getAvailableSlotsForDate(selectedDate).length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-900">
                    All slots for this date have been booked. Please select another date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {event.availableSlots.map((slot) => {
                    const isBooked = isSlotBooked(selectedDate, slot)
                    const isSelected = selectedSlot === slot
                    
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isBooked}
                        onClick={() => !isBooked && setSelectedSlot(slot)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isBooked
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                            : isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                        }`}
                      >
                        <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {slot}
                        </div>
                        {isBooked && (
                          <div className="text-xs mt-1 text-gray-800">Booked</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {selectedDate && selectedSlot && !isSlotBooked(selectedDate, selectedSlot) && (
            <form onSubmit={handleBooking} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={bookingForm.name}
                  onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={bookingForm.email}
                  onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-900 mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  id="phone"
                  required
                  value={bookingForm.phone}
                  onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-900 mb-2">
                  Note (optional)
                </label>
                <textarea
                  id="note"
                  rows={3}
                  value={bookingForm.note}
                  onChange={(e) => setBookingForm({ ...bookingForm, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="Any additional information..."
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-900">
                  <strong>Selected Slot:</strong> {format(new Date(selectedDate), 'MMM dd, yyyy')} at {selectedSlot}
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
          )}

          {(!selectedDate || !selectedSlot) && (
            <div className="text-center text-gray-700 py-8">
              {!selectedDate 
                ? 'Please select a date above to continue'
                : 'Please select a time slot above to continue'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BookEventPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-800">Loading...</div>
      </div>
    }>
      <BookEventContent />
    </Suspense>
  )
}
