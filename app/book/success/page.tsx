 'use client'
 
 import { useRouter, useSearchParams } from 'next/navigation'
 
 export default function BookingSuccessPage() {
   const router = useRouter()
   const searchParams = useSearchParams()
   const eventId = searchParams?.get('eventId') || ''
 
   return (
     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
       <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
         <div className="flex justify-center mb-4">
           <img src="/images/logo-dark.png" alt="Logo" className="h-16 object-contain" />
         </div>
         <h1 className="text-3xl font-bold text-gray-900 mb-4">Booking confirmed!</h1>
         <p className="text-gray-700 mb-6">
           Thank you — your booking has been successfully created. A confirmation email with calendar attachments has been sent to you.
         </p>
 
         <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              if (eventId) {
                router.push(`/book?eventId=${encodeURIComponent(eventId)}`)
              } else {
                router.push('/book')
              }
            }}
            className="px-6 py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Book another technology
          </button>
         </div>
       </div>
     </div>
   )
 }
