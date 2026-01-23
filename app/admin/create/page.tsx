'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createEvent, getAllDevices } from '@/lib/firestore'
import { Device } from '@/types'
import toast from 'react-hot-toast'
import { isAuthenticated } from '@/lib/auth'

export default function CreateEvent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      router.push('/admin/login')
      return
    }
    setAuthChecked(true)
    loadDevices()
  }, [router])

  const loadDevices = async () => {
    try {
      const devicesData = await getAllDevices()
      setDevices(devicesData)
    } catch (error) {
      console.error('Error loading devices:', error)
      toast.error('Failed to load devices')
    } finally {
      setLoadingDevices(false)
    }
  }

  const toggleDevice = (deviceId: string) => {
    if (formData.deviceIds.includes(deviceId)) {
      setFormData({
        ...formData,
        deviceIds: formData.deviceIds.filter(id => id !== deviceId),
      })
    } else {
      setFormData({
        ...formData,
        deviceIds: [...formData.deviceIds, deviceId],
      })
    }
  }
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDates: [] as string[],
    slotDuration: 30,
    startTime: '09:00',
    endTime: '17:00',
    deviceIds: [] as string[],
  })
  const [dateInput, setDateInput] = useState('')
  const [devices, setDevices] = useState<Device[]>([])
  const [loadingDevices, setLoadingDevices] = useState(true)

  const generateTimeSlots = (startTime: string, endTime: string, duration: number): string[] => {
    const slots: string[] = []
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += duration) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`)
    }
    
    return slots
  }

  const addDate = () => {
    if (dateInput && !formData.eventDates.includes(dateInput)) {
      setFormData({ ...formData, eventDates: [...formData.eventDates, dateInput].sort() })
      setDateInput('')
    }
  }

  const removeDate = (dateToRemove: string) => {
    setFormData({ 
      ...formData, 
      eventDates: formData.eventDates.filter(date => date !== dateToRemove) 
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.description || formData.eventDates.length === 0) {
      toast.error('Please fill in all required fields and select at least one date')
      return
    }

    setLoading(true)

    try {
      const availableSlots = generateTimeSlots(
        formData.startTime,
        formData.endTime,
        formData.slotDuration
      )

      if (formData.deviceIds.length === 0) {
        toast.error('Please select at least one device for this event')
        setLoading(false)
        return
      }

      const eventData: any = {
        title: formData.title,
        description: formData.description,
        eventDates: formData.eventDates,
        slotDuration: formData.slotDuration,
        availableSlots,
        deviceIds: formData.deviceIds,
        enabled: true, // Events are enabled by default
      }

      const eventId = await createEvent(eventData)
      toast.success('Event created successfully!')
      router.push(`/admin?created=${eventId}`)
    } catch (error) {
      console.error('Error creating event:', error)
      toast.error('Failed to create event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const previewSlots = generateTimeSlots(
    formData.startTime,
    formData.endTime,
    formData.slotDuration
  )

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
          <Link
            href="/admin"
            className="text-gray-800 hover:text-gray-900"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-900 mb-2">
                Event Title *
              </label>
              <input
                type="text"
                id="title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                placeholder="e.g., Product Demo Session"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                id="description"
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                placeholder="Describe your event..."
              />
            </div>

            {/* Event Dates */}
            <div>
              <label htmlFor="eventDate" className="block text-sm font-medium text-gray-900 mb-2">
                Event Dates * (Select multiple dates)
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="date"
                  id="eventDate"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  min={new Date().toISOString().split('T')[0]}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addDate()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addDate}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add Date
                </button>
              </div>
              {formData.eventDates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.eventDates.map((date) => (
                    <span
                      key={date}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-900 rounded-lg text-sm"
                    >
                      {new Date(date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      <button
                        type="button"
                        onClick={() => removeDate(date)}
                        className="text-indigo-700 hover:text-indigo-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {formData.eventDates.length === 0 && (
                <p className="text-sm text-gray-800 mt-1">No dates selected. Add dates above.</p>
              )}
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-900 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  id="startTime"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-900 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  id="endTime"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>

            {/* Slot Duration */}
            <div>
              <label htmlFor="slotDuration" className="block text-sm font-medium text-gray-900 mb-2">
                Slot Duration (minutes)
              </label>
              <select
                id="slotDuration"
                value={formData.slotDuration}
                onChange={(e) => setFormData({ ...formData, slotDuration: Number(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            {/* Device Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Devices * (At least one device required)
              </label>
              {loadingDevices ? (
                <p className="text-sm text-gray-600">Loading devices...</p>
              ) : devices.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-900 text-sm mb-2">
                    No devices available. Please create devices first.
                  </p>
                  <Link
                    href="/admin/devices"
                    className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                  >
                    Go to Device Management →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {devices.map((device) => {
                      const isSelected = formData.deviceIds.includes(device.id)
                      return (
                        <button
                          key={device.id}
                          type="button"
                          onClick={() => toggleDevice(device.id)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500'
                              : 'bg-white border-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-gray-400'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">{device.name}</div>
                              {device.description && (
                                <div className="text-xs text-gray-600 mt-1">{device.description}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {formData.deviceIds.length === 0 && (
                    <p className="text-sm text-red-600 mt-2">Please select at least one device</p>
                  )}
                  {formData.deviceIds.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      {formData.deviceIds.length} device{formData.deviceIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Preview Slots */}
            {previewSlots.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Preview: Available Time Slots ({previewSlots.length} slots)
                </label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex flex-wrap gap-2">
                    {previewSlots.map((slot) => (
                      <span
                        key={slot}
                        className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded text-sm"
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Link
                href="/admin"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
