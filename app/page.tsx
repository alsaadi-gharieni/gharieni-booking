'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllEvents } from '@/lib/firestore'
import { Event } from '@/types'

export default function Home() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const data = await getAllEvents()
        if (!mounted) return
        // show only enabled future/current events
        const nowIso = new Date().toISOString()
        const enabled = data.filter(e => e.enabled !== false)
        setEvents(enabled)
      } catch (err) {
        console.error('Failed loading events', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <main className="min-h-screen flex items-start justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="w-full max-w-4xl px-4">
        <div className="mb-8 flex justify-center">
          <img src="/images/logo-dark.png" alt="Logo" className="h-24 object-contain" />
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4 text-center">Gharieni Booking</h1>
        <p className="text-gray-700 mb-8 text-center">Select an event below to view available technologies and book a slot.</p>

        {loading ? (
          <div className="text-center text-gray-700">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-700">No events available right now.</div>
        ) : (
          <div className="space-y-4">
            {events.map(ev => (
              <div key={ev.id} className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{ev.title}</h2>
                  <p className="text-sm text-gray-700 mt-1">{ev.description}</p>
                  <p className="text-xs text-gray-500 mt-2">Dates: {ev.eventDates?.slice(0,3).map(d => new Date(d).toLocaleDateString()).join(', ')}{ev.eventDates && ev.eventDates.length > 3 ? '...' : ''}</p>
                </div>
                <div className="flex gap-3">
                  <Link href={`/book?eventId=${ev.id}`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Book
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
