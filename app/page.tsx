import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <img
            src="/images/logo-dark.png"
            alt="Logo"
            className="h-24 object-contain"
          />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Gharieni Booking System
        </h1>
        <p className="text-gray-800 mb-8">Manage your event bookings</p>
        <Link
          href="/admin/login"
          className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Go to Admin Dashboard
        </Link>
      </div>
    </main>
  )
}
