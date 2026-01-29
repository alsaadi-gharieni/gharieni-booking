'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getEventById, getBookingBySlot, createBooking, getBookingByUserAtSlot, getBookingsByEventId, getDevicesByIds } from '@/lib/firestore'
import { Event, Device } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import Image from 'next/image'

function BookEventContent() {
  const searchParams = useSearchParams()
  // Get eventId from query parameter (e.g., /book?eventId=abc123)
  const eventId = searchParams?.get('eventId') || ''
  
  const [event, setEvent] = useState<Event | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDeviceBookings, setSelectedDeviceBookings] = useState<Record<string, { date?: string | null; slot?: string | null }>>({})
  const allDevicesHaveSelection = selectedDeviceIds.length > 0 && selectedDeviceIds.every(id => {
    const sel = selectedDeviceBookings[id]
    return sel && sel.date && sel.slot
  })
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    note: '',
    confirmedArrival: false,
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
    
    if (!allDevicesHaveSelection) {
      toast.error('Please select a date and time slot for each selected device')
      return
    }

    if (!bookingForm.name || !bookingForm.email || !bookingForm.phone) {
      toast.error('Please fill in your name, email, and phone number')
      return
    }

    if (!bookingForm.confirmedArrival) {
      toast.error('Please confirm that you will arrive 15 minutes early')
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
      // Double-check slot availability for each selected device (use per-device selection)
      for (const deviceId of selectedDeviceIds) {
        const sel = selectedDeviceBookings[deviceId]
        if (!sel || !sel.date || !sel.slot) {
          toast.error('Missing date/slot for one of the selected devices')
          setSubmitting(false)
          return
        }
        const existingBooking = await getBookingBySlot(
          eventId,
          sel.date,
          sel.slot,
          deviceId
        )
        if (existingBooking) {
          const deviceName = devices.find(d => d.id === deviceId)?.name || deviceId
          toast.error(`"${deviceName}" is already booked for ${sel.date} ${sel.slot}. Please adjust your selection.`)
          setSubmitting(false)
          return
        }
      }

      // Prevent same user from having another booking at the same date+slot (any device)
      for (const deviceId of selectedDeviceIds) {
        const sel = selectedDeviceBookings[deviceId]!
        const userExisting = await getBookingByUserAtSlot(
          eventId,
          sel.date!,
          sel.slot!,
          bookingForm.email.trim(),
          bookingForm.phone.trim()
        )
        if (userExisting) {
          const conflictDeviceName = devices.find(d => d.id === userExisting.deviceId)?.name || userExisting.deviceId
          toast.error(`You already have a booking for "${conflictDeviceName}" at ${userExisting.date} ${userExisting.slotTime}. Please adjust your selections.`)
          setSubmitting(false)
          return
        }
      }

      // Create one booking per selected device using each device's selected date/slot
      for (const deviceId of selectedDeviceIds) {
        const sel = selectedDeviceBookings[deviceId]
        const bookingData: any = {
          eventId,
          deviceId,
          slotTime: sel!.slot!,
          date: sel!.date!,
          name: bookingForm.name.trim(),
          email: bookingForm.email.toLowerCase().trim(),
          phone: bookingForm.phone.trim(),
        }
        if (bookingForm.note && bookingForm.note.trim() !== '') {
          bookingData.note = bookingForm.note.trim()
        }
        await createBooking(bookingData)
      }

      toast.success('Booking confirmed!')
      await loadEvent()
      setSelectedSlot(null)
      setSelectedDate(null)
      setSelectedDeviceIds([])
      setBookingForm({ name: '', email: '', phone: '', note: '', confirmedArrival: false })
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

  const getAvailableDatesForDevices = (deviceIds: string[]) => {
    if (!deviceIds || deviceIds.length === 0) return []
    return event.eventDates.filter(date => {
      return deviceIds.every(deviceId => {
        const availableSlots = getAvailableSlotsForDate(date, deviceId)
        return availableSlots.length > 0
      })
    })
  }

  const getAvailableSlotsForDateForDevices = (date: string, deviceIds: string[]) => {
    if (!deviceIds || deviceIds.length === 0) return []
    return event.availableSlots.filter(slot => {
      return deviceIds.every(deviceId => !isSlotBooked(date, slot, deviceId))
    })
  }

  const handleDeviceSelect = (deviceId: string) => {
    if (selectedDeviceIds.includes(deviceId)) {
      setSelectedDeviceIds(selectedDeviceIds.filter(id => id !== deviceId))
      // remove booking entry
      setSelectedDeviceBookings(prev => {
        const copy = { ...prev }
        delete copy[deviceId]
        return copy
      })
    } else {
      setSelectedDeviceIds([...selectedDeviceIds, deviceId])
      // initialize booking entry
      setSelectedDeviceBookings(prev => ({
        ...prev,
        [deviceId]: { date: null, slot: null },
      }))
    }
    setSelectedDate(null)
    setSelectedSlot(null)
  }

  const handleDeviceDateSelect = (deviceId: string, date: string) => {
    setSelectedDeviceBookings(prev => ({
      ...prev,
      [deviceId]: { ...(prev[deviceId] || {}), date, slot: null },
    }))
  }

  const handleDeviceSlotSelect = (deviceId: string, slot: string) => {
    setSelectedDeviceBookings(prev => {
      // clear same slot selection from other devices that have same date
      const updated = { ...prev, [deviceId]: { ...(prev[deviceId] || {}), slot } }
      const sel = updated[deviceId]
      if (sel && sel.date) {
        for (const otherId of selectedDeviceIds) {
          if (otherId === deviceId) continue
          const otherSel = updated[otherId]
          if (otherSel && otherSel.date === sel.date && otherSel.slot === slot) {
            updated[otherId] = { ...otherSel, slot: null }
          }
        }
      }
      return updated
    })
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
          {event.location && (
            <div className="flex justify-center mb-4">
              <a
                href={event.location}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-medium shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Location
              </a>
            </div>
          )}
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
              Select Devices * (choose one or more)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devices.map((device) => {
                const isSelected = selectedDeviceIds.includes(device.id)
                const availableDates = getAvailableDatesForDevice(device.id)
                const hasAvailability = availableDates.length > 0
                
                return (
                  <button
                    key={device.id}
                    type="button"
                    disabled={!hasAvailability}
                    onClick={() => handleDeviceSelect(device.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left relative ${
                      !hasAvailability
                        ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                    }`}
                  >
                    {device.link && (
                      <a
                        href={device.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`absolute bottom-2 right-2 px-2 py-1 rounded-md text-xs font-medium shadow-lg backdrop-blur-sm transition-all z-10 ${
                          isSelected
                            ? 'bg-white/90 text-indigo-600 hover:bg-white'
                            : 'bg-indigo-600/90 text-white hover:bg-indigo-700'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        🔗 Learn More
                      </a>
                    )}
                    <div className="flex flex-col items-center gap-3">
                      {device.imageUrl && (
                        <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-lg overflow-hidden border-2 border-gray-200">
                          <Image
                            src={device.imageUrl}
                            alt={device.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="text-center w-full">
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
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Per-device Date & Time Selection */}
          {selectedDeviceIds.length > 0 && (
            <div className="mb-8 space-y-4">
              {selectedDeviceIds.map((deviceId) => {
                const device = devices.find(d => d.id === deviceId)
                const sel = selectedDeviceBookings[deviceId] || { date: null, slot: null }
                const availableDates = getAvailableDatesForDevice(deviceId)
                return (
                  <div key={deviceId} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900">{device?.name || deviceId}</div>
                      <div className="text-xs text-gray-500">Select date & time</div>
                    </div>
                    {availableDates.length === 0 ? (
                      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-yellow-900 text-sm">No available dates for this device.</p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="text-sm text-gray-700 mb-2">Available Dates</div>
                        <div className="flex flex-wrap gap-2">
                          {availableDates.map((date) => {
                            const isSel = sel.date === date
                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() => handleDeviceDateSelect(deviceId, date)}
                            className={`px-3 py-2 rounded-md text-sm border ${isSel ? 'bg-indigo-600 text-white' : 'bg-white border-gray-300 hover:bg-indigo-50 text-gray-800'}`}
                              >
                                {format(new Date(date), 'MMM dd')}
                              </button>
                            )
                          })}
                        </div>

                        {sel.date && (
                          <div className="mt-3">
                            <div className="text-sm text-gray-700 mb-2">Available Time Slots for {format(new Date(sel.date!), 'MMM dd, yyyy')}</div>
                            <div className="grid grid-cols-3 gap-2">
                              {(() => {
                                const allSlots = getAvailableSlotsForDate(sel.date!, deviceId)
                                // slots already chosen by other devices for the same date
                                const blockedSlots = selectedDeviceIds
                                  .filter(id => id !== deviceId)
                                  .map(id => selectedDeviceBookings[id])
                                  .filter(s => s && s.date === sel.date)
                                  .map(s => s!.slot)

                                return allSlots.map((slot) => {
                                  const isSlotSel = sel.slot === slot
                                  const isBlocked = blockedSlots.includes(slot!)
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => {
                                        if (isBlocked) return
                                        handleDeviceSlotSelect(deviceId, slot)
                                      }}
                                      disabled={isBlocked}
                                      className={`px-2 py-2 rounded-md text-sm border ${isSlotSel ? 'bg-indigo-600 text-white' : (isBlocked ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 hover:bg-indigo-50 text-gray-900')}`}
                                      title={isBlocked ? 'This slot is already selected for another device' : undefined}
                                    >
                                      {slot}
                                    </button>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {sel.date && sel.slot && (
                      <div className="mt-3 text-sm text-gray-700">
                        Selected: <strong>{format(new Date(sel.date!), 'MMM dd, yyyy')}</strong> at <strong>{sel.slot}</strong>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {allDevicesHaveSelection && (() => {
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
                <p className="text-sm text-gray-900 font-medium">Selected Bookings:</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-900">
                  {selectedDeviceIds.map((id) => {
                    const sel = selectedDeviceBookings[id]
                    const name = devices.find(d => d.id === id)?.name || id
                    return (
                      <li key={id}>
                        <strong>{name}</strong>: {sel?.date ? format(new Date(sel.date), 'MMM dd, yyyy') : '—'} at {sel?.slot || '—'}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookingForm.confirmedArrival}
                    onChange={(e) => setBookingForm({ ...bookingForm, confirmedArrival: e.target.checked })}
                    className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    required
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      I confirm that I will arrive at least 15 minutes before my scheduled booking time. *
                    </span>
                    <p className="text-xs text-gray-700 mt-1">
                      I understand that late arrival may result in the booking being canceled and made available to another guest.
                    </p>
                  </div>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || !bookingForm.confirmedArrival}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </form>
            )
          })()}

          {((selectedDeviceIds.length === 0) || !selectedDate || !selectedSlot) && (
            <div className="text-center text-gray-700 py-8">
              {selectedDeviceIds.length === 0
                ? 'Please select at least one device above to continue'
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
