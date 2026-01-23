'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getEventById, getBookingBySlot, createBooking, checkExistingBooking, getBookingsByEventId, getDevicesByIds } from '@/lib/firestore'
import { Event, Device } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

function BookEventContent() {
  const searchParams = useSearchParams()
  // Get eventId from query parameter (e.g., /book?eventId=abc123)
  const eventId = searchParams?.get('eventId') || ''
  
  const [event, setEvent] = useState<Event | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    note: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<Map<string, Map<string, Set<string>>>>(new Map()) // Map<date, Map<deviceId, Set<slotTime>>>

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
        setLoading(false)
        return
      }
      setEvent(eventData)
      
      // Load devices for this event
      if (eventData.deviceIds && eventData.deviceIds.length > 0) {
        const devicesData = await getDevicesByIds(eventData.deviceIds)
        setDevices(devicesData)
      }
      
      // Load all bookings for this event to check availability per device
      const allBookings = await getBookingsByEventId(eventId)
      
      // Build booked slots map: Map<date, Map<deviceId, Set<slotTime>>>
      const bookedMap = new Map<string, Map<string, Set<string>>>()
      
      // Initialize for all dates and devices
      for (const date of eventData.eventDates) {
        const dateMap = new Map<string, Set<string>>()
        for (const deviceId of eventData.deviceIds || []) {
          dateMap.set(deviceId, new Set<string>())
        }
        bookedMap.set(date, dateMap)
      }
      
      // Mark booked slots per device
      allBookings.forEach(booking => {
        const dateMap = bookedMap.get(booking.date)
        if (dateMap && booking.deviceId) {
          const deviceSet = dateMap.get(booking.deviceId)
          if (deviceSet) {
            deviceSet.add(booking.slotTime)
          }
        }
      })
      
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
    
    if (!selectedDate || !selectedSlot || !selectedDeviceId) {
      toast.error('Please select a date, time slot, and device')
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
      // Double-check slot availability for this specific device
      const existingBooking = await getBookingBySlot(
        eventId,
        selectedDate,
        selectedSlot,
        selectedDeviceId
      )
      
      if (existingBooking) {
        toast.error('This device slot has already been booked. Please select another device or time.')
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
        deviceId: selectedDeviceId,
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
      setSelectedDeviceId(null)
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

  // Check if event has devices
  if (!event.deviceIds || event.deviceIds.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
          <p className="text-gray-800 mb-4">This event is not configured with any devices. Please contact the administrator.</p>
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

  const getAvailableSlotsForDate = (date: string, deviceId: string) => {
    if (!deviceId) return []
    const dateMap = bookedSlots.get(date) || new Map<string, Set<string>>()
    const bookedForDevice = dateMap.get(deviceId) || new Set<string>()
    return event.availableSlots.filter(slot => !bookedForDevice.has(slot))
  }

  const isSlotBooked = (date: string, slot: string, deviceId: string) => {
    const dateMap = bookedSlots.get(date) || new Map<string, Set<string>>()
    const bookedForDevice = dateMap.get(deviceId) || new Set<string>()
    return bookedForDevice.has(slot)
  }

  const getAvailableDatesForDevice = (deviceId: string) => {
    if (!deviceId) return []
    return event.eventDates.filter(date => {
      const availableSlots = getAvailableSlotsForDate(date, deviceId)
      return availableSlots.length > 0
    })
  }

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    setSelectedSlot(null)
  }

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot)
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
          
          {/* Device Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-900 mb-4">
              Select a Device *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devices.map((device) => {
                const isSelected = selectedDeviceId === device.id
                const availableDates = getAvailableDatesForDevice(device.id)
                const hasAvailability = availableDates.length > 0
                
                return (
                  <button
                    key={device.id}
                    type="button"
                    disabled={!hasAvailability}
                    onClick={() => handleDeviceSelect(device.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      !hasAvailability
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {device.name}
                    </div>
                    {device.description && (
                      <div className={`text-xs mt-1 ${isSelected ? 'text-indigo-100' : 'text-gray-600'}`}>
                        {device.description}
                      </div>
                    )}
                    <div className={`text-xs mt-2 ${isSelected ? 'text-indigo-100' : 'text-gray-600'}`}>
                      {hasAvailability 
                        ? `${availableDates.length} date${availableDates.length !== 1 ? 's' : ''} available`
                        : 'No availability'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date Selection */}
          {selectedDeviceId && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-900 mb-4">
                Select a Date for {devices.find(d => d.id === selectedDeviceId)?.name} *
              </label>
              {getAvailableDatesForDevice(selectedDeviceId).length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-900">
                    No available dates for this device. Please select another device.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {getAvailableDatesForDevice(selectedDeviceId).map((date) => {
                    const isSelected = selectedDate === date
                    const availableSlots = getAvailableSlotsForDate(date, selectedDeviceId)
                    
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => handleDateSelect(date)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                        }`}
                      >
                        <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {format(new Date(date), 'EEEE, MMM dd, yyyy')}
                        </div>
                        <div className={`text-xs mt-1 ${isSelected ? 'text-indigo-100' : 'text-gray-800'}`}>
                          {availableSlots.length} slot{availableSlots.length !== 1 ? 's' : ''} available
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Time Slot Selection */}
          {selectedDate && selectedDeviceId && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-900 mb-4">
                Select a Time Slot for {format(new Date(selectedDate), 'MMM dd, yyyy')} *
              </label>
              {(() => {
                const availableSlots = getAvailableSlotsForDate(selectedDate, selectedDeviceId)
                
                if (availableSlots.length === 0) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-900">
                        All slots for this date have been booked. Please select another date.
                      </p>
                    </div>
                  )
                }
                
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot === slot
                      
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleSlotSelect(slot)}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                          }`}
                        >
                          <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {slot}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {selectedDate && selectedSlot && selectedDeviceId && (() => {
            const availableSlots = getAvailableSlotsForDate(selectedDate, selectedDeviceId)
            const isSlotAvailable = availableSlots.includes(selectedSlot)
            if (!isSlotAvailable) return null
            
            return (
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
                {selectedDeviceId && (
                  <p className="text-sm text-gray-900 mt-1">
                    <strong>Selected Device:</strong> {devices.find(d => d.id === selectedDeviceId)?.name}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
            )
          })()}

          {(!selectedDeviceId || !selectedDate || !selectedSlot) && (
            <div className="text-center text-gray-700 py-8">
              {!selectedDeviceId 
                ? 'Please select a device above to continue'
                : !selectedDate
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
