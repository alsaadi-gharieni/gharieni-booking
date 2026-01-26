'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAllEvents, getBookingsByEventId, toggleEventEnabled, deleteEvent, deleteBooking, getDevicesByIds } from '@/lib/firestore'
import { Event, Booking, Device } from '@/types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { isAuthenticated, logout, getAdminEmail } from '@/lib/auth'

export default function AdminDashboard() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push('/admin/login')
      return
    }
    setAuthChecked(true)
    loadEvents()
  }, [router])

  useEffect(() => {
    // Auto-select newly created event
    if (typeof window !== 'undefined' && events.length > 0) {
      const params = new URLSearchParams(window.location.search)
      const createdEventId = params.get('created')
      if (createdEventId && !selectedEvent) {
        const event = events.find(e => e.id === createdEventId)
        if (event) {
          handleEventSelect(event)
          toast.success('Event created successfully!')
          window.history.replaceState({}, '', '/admin')
        }
      }
    }
  }, [events])

  const loadEvents = async () => {
    try {
      const eventsData = await getAllEvents()
      setEvents(eventsData)
    } catch (error) {
      console.error('Error loading events:', error)
      toast.error('Failed to load events. Check console for details.')
      // Check if it's a Firebase config error
      if (error instanceof Error && error.message.includes('Firebase')) {
        toast.error('Firebase configuration error. Please check environment variables.')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadBookings = async (eventId: string) => {
    try {
      console.log('Loading bookings for event:', eventId)
      const bookingsData = await getBookingsByEventId(eventId)
      console.log('Bookings loaded:', bookingsData)
      setBookings(bookingsData)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error loading bookings:', error)
      toast.error('Failed to load bookings. Check console for details.')
    }
  }

  const loadDevices = async (deviceIds: string[]) => {
    try {
      if (deviceIds && deviceIds.length > 0) {
        const devicesData = await getDevicesByIds(deviceIds)
        setDevices(devicesData)
      } else {
        setDevices([])
      }
    } catch (error) {
      console.error('Error loading devices:', error)
      setDevices([])
    }
  }

  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event)
    loadBookings(event.id)
    loadDevices(event.deviceIds || [])
  }

  // Refresh bookings for selected event
  const refreshBookings = () => {
    if (selectedEvent) {
      loadBookings(selectedEvent.id)
    }
  }

  // Auto-refresh bookings every 5 seconds
  useEffect(() => {
    if (!selectedEvent) return
    
    // Load immediately
    loadBookings(selectedEvent.id)
    
    // Then refresh every 5 seconds
    const interval = setInterval(() => {
      loadBookings(selectedEvent.id)
    }, 5000) // Refresh every 5 seconds
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id])

  const copyEventLink = (eventId: string) => {
    const link = `${window.location.origin}/book?eventId=${eventId}`
    navigator.clipboard.writeText(link)
    toast.success('Link copied to clipboard!')
  }

  const handleToggleEvent = async (eventId: string, currentStatus: boolean, eventTitle: string) => {
    const action = !currentStatus ? 'enable' : 'disable'
    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${eventTitle}"?\n\n` +
      `${action === 'disable' ? 'Users will not be able to book slots for this event.' : 'Users will be able to book slots for this event.'}`
    )
    
    if (!confirmed) {
      return
    }
    
    try {
      await toggleEventEnabled(eventId, !currentStatus)
      toast.success(`Event ${action}d successfully`)
      await loadEvents()
      // Reload selected event if it's the one being toggled
      if (selectedEvent?.id === eventId) {
        const updatedEvent = events.find(e => e.id === eventId)
        if (updatedEvent) {
          setSelectedEvent({ ...updatedEvent, enabled: !currentStatus })
        }
      }
    } catch (error) {
      console.error('Error toggling event:', error)
      toast.error('Failed to update event status')
    }
  }

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    const confirmed = window.confirm(
      `⚠️ WARNING: Delete Event\n\n` +
      `Are you sure you want to delete "${eventTitle}"?\n\n` +
      `This will permanently delete:\n` +
      `• The event and all its data\n` +
      `• All associated bookings\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE" to confirm:`
    )
    
    if (!confirmed) {
      return
    }
    
    // Double confirmation
    const doubleConfirm = window.prompt('Type "DELETE" to confirm deletion:')
    if (doubleConfirm !== 'DELETE') {
      toast.error('Deletion cancelled. You must type "DELETE" to confirm.')
      return
    }
    
    try {
      await deleteEvent(eventId)
      toast.success('Event deleted successfully')
      await loadEvents()
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null)
        setBookings([])
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      toast.error('Failed to delete event')
    }
  }

  const handleCancelBooking = async (bookingId: string, bookingName: string) => {
    const confirmed = window.confirm(
      `Cancel Booking\n\n` +
      `Are you sure you want to cancel the booking for "${bookingName}"?\n\n` +
      `This will free up the time slot for other users.\n\n` +
      `This action cannot be undone.`
    )
    
    if (!confirmed) {
      return
    }
    
    try {
      await deleteBooking(bookingId)
      toast.success('Booking cancelled successfully')
      if (selectedEvent) {
        await loadBookings(selectedEvent.id)
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error('Failed to cancel booking')
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    router.push('/admin/login')
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <img
              src="/images/logo-dark.png"
              alt="Logo"
              className="h-12 object-contain"
            />
            {/* <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1> */}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {getAdminEmail()}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Logout
            </button>
            <Link
              href="/admin/devices"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors"
            >
              Manage Devices
            </Link>
            <Link
              href="/admin/create"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create New Event
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Events List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Events</h2>
            <div className="space-y-3">
              {events.length === 0 ? (
                <p className="text-gray-800">No events yet. Create your first event!</p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                      selectedEvent?.id === event.id
                        ? 'bg-indigo-50 border-indigo-500 shadow-md'
                        : 'bg-white border-gray-200 hover:border-indigo-400 hover:shadow-lg hover:scale-[1.02]'
                    }`}
                    onClick={() => handleEventSelect(event)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 flex-1">{event.title}</h3>
                      <span className="text-indigo-600 text-xs font-medium ml-2">
                        👆 Click to view
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mt-1 line-clamp-2">
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-700 mt-2">
                      {event.eventDates.length} date{event.eventDates.length !== 1 ? 's' : ''}: {event.eventDates.slice(0, 2).map(d => format(new Date(d), 'MMM dd')).join(', ')}{event.eventDates.length > 2 ? '...' : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${event.enabled !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {event.enabled !== false ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    
                    {/* Copy Link - Separated from action buttons */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copyEventLink(event.id)
                        }}
                        className="w-full px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium transition-colors"
                      >
                        📋 Copy Booking Link
                      </button>
                    </div>
                    
                    {/* Action Buttons - Separated with more spacing */}
                    <div className="mt-2 flex gap-2">
                      <Link
                        href={`/admin/create?eventId=${event.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-medium transition-colors text-center"
                      >
                        ✏️ Edit
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleEvent(event.id, event.enabled !== false, event.title)
                        }}
                        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          event.enabled !== false
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {event.enabled !== false ? '⏸ Disable' : '▶ Enable'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteEvent(event.id, event.title)
                        }}
                        className="flex-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-xs font-medium transition-colors"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bookings and Availability */}
          <div className="lg:col-span-2">
            {selectedEvent ? (
              <div>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Bookings for: {selectedEvent.title}
                    </h2>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${selectedEvent.enabled !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {selectedEvent.enabled !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {lastRefresh && (
                    <p className="text-xs text-gray-600 mb-4">
                      Last updated: {format(lastRefresh, 'HH:mm:ss')}
                    </p>
                  )}
                  {/* Big buttons in one row */}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/create?eventId=${selectedEvent.id}`}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-base font-semibold shadow-md hover:shadow-lg"
                    >
                      ✏️ Edit Event
                    </Link>
                    <button
                      onClick={() => handleToggleEvent(selectedEvent.id, selectedEvent.enabled !== false, selectedEvent.title)}
                      className={`px-6 py-3 rounded-lg transition-all text-base font-semibold shadow-md hover:shadow-lg ${
                        selectedEvent.enabled !== false
                          ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {selectedEvent.enabled !== false ? '⏸ Disable Event' : '▶ Enable Event'}
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.title)}
                      className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-base font-semibold shadow-md hover:shadow-lg"
                    >
                      🗑 Delete Event
                    </button>
                    <button
                      onClick={refreshBookings}
                      className="px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all text-base font-semibold shadow-md hover:shadow-lg"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>
                
                {/* Availability Overview */}
                <div className="bg-white rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Availability by Date and Device</h3>
                  <div className="space-y-6">
                    {selectedEvent.eventDates.map((date) => {
                      const dateBookings = bookings.filter(b => b.date === date)
                      
                      return (
                        <div key={date}>
                          <h4 className="font-medium text-gray-900 mb-3">
                            {format(new Date(date), 'EEEE, MMMM dd, yyyy')}
                          </h4>
                          {devices.length === 0 ? (
                            <p className="text-sm text-gray-600">No devices attached to this event</p>
                          ) : (
                            <div className="space-y-4">
                              {devices.map((device) => {
                                const deviceBookings = dateBookings.filter(b => b.deviceId === device.id)
                                const bookedSlotsForDevice = new Set(deviceBookings.map(b => b.slotTime))
                                
                                return (
                                  <div key={device.id}>
                                    <h5 className="text-sm font-medium text-gray-700 mb-2">{device.name}</h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                      {selectedEvent.availableSlots.map((slot) => {
                                        const isBooked = bookedSlotsForDevice.has(slot)
                                        return (
                                          <div
                                            key={`${date}-${device.id}-${slot}`}
                                            className={`p-2 rounded border text-center ${
                                              isBooked
                                                ? 'bg-red-50 border-red-200'
                                                : 'bg-green-50 border-green-200'
                                            }`}
                                          >
                                            <div className="font-medium text-gray-900 text-sm">{slot}</div>
                                            <div className={`text-xs mt-1 ${isBooked ? 'text-red-800' : 'text-green-800'}`}>
                                              {isBooked ? 'Booked' : 'Available'}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Bookings List */}
                <div className="bg-white rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900">All Bookings</h3>
                    <span className="text-sm text-gray-600">
                      ({bookings.length} booking{bookings.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  {bookings.length === 0 ? (
                    <div>
                      <p className="text-gray-800">No bookings yet.</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Event ID: {selectedEvent.id}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">
                                {booking.name}
                              </div>
                              <div className="text-sm text-gray-800 mt-1">
                                {booking.email}
                              </div>
                              <div className="text-sm text-gray-800 mt-1">
                                Phone: {booking.phone}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                {format(new Date(booking.date), 'MMM dd, yyyy')} at {booking.slotTime}
                              </div>
                              {booking.deviceId && (
                                <div className="text-sm text-gray-700 mt-1">
                                  Device: {devices.find(d => d.id === booking.deviceId)?.name || booking.deviceId}
                                </div>
                              )}
                              {booking.note && (
                                <div className="text-sm text-gray-800 mt-2 italic">
                                  "{booking.note}"
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleCancelBooking(booking.id, booking.name)}
                              className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm font-medium shadow-sm hover:shadow-md whitespace-nowrap"
                            >
                              Cancel Booking
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-12 text-center">
                <p className="text-gray-800">Select an event to view bookings and availability</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
