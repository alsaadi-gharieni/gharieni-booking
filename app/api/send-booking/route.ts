import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

type BookingItem = {
  deviceId: string
  deviceName?: string
  date: string
  slot: string
  bookingId?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, phone, eventTitle, bookings, note } = body as {
      name: string
      email: string
      phone?: string
      eventTitle: string
      bookings: BookingItem[]
      note?: string
    }

    if (!email || !bookings || bookings.length === 0) {
      return NextResponse.json({ error: 'Missing email or bookings' }, { status: 400 })
    }

    // SMTP host/port/from are constants for now; only user and pass come from environment
    const host = 'smtp.gmail.com' // change if you use another SMTP provider
    const port: number = 587
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const from = 'no-reply@gharieni-booking.firebaseapp.com'

    if (!user || !pass) {
      console.error('Missing SMTP_USER or SMTP_PASS in environment')
      return NextResponse.json({ error: 'SMTP credentials not configured' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    })

    // Build HTML
    const bookingRows = bookings
      .map(
        (b) => `<tr>
      <td style="padding:6px 10px;border:1px solid #eee">${b.deviceName || b.deviceId}</td>
      <td style="padding:6px 10px;border:1px solid #eee">${b.date}</td>
      <td style="padding:6px 10px;border:1px solid #eee">${b.slot}</td>
    </tr>`
      )
      .join('')

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111">
        <h2>Booking confirmation — ${eventTitle}</h2>
        <p>Hi ${name},</p>
        <p>Thanks — your booking${bookings.length > 1 ? 's' : ''} are confirmed:</p>
        <table style="border-collapse:collapse; width:100%; max-width:600px">
          <thead>
            <tr>
              <th style="text-align:left; padding:6px 10px; border:1px solid #eee">Technology</th>
              <th style="text-align:left; padding:6px 10px; border:1px solid #eee">Date</th>
              <th style="text-align:left; padding:6px 10px; border:1px solid #eee">Time</th>
            </tr>
          </thead>
          <tbody>
            ${bookingRows}
          </tbody>
        </table>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
        <p>If you'd like to add these to your calendar, please download the attached .ics file.</p>
        <p>Regards,<br/>Booking Team</p>
      </div>
    `

    // Create a single ICS file containing all events
    const icsEvents = bookings
      .map((b, i) => {
        // convert date+slot like "2026-02-03" and "12:00" to DTSTART/DTEND in UTC naive (assume local)
        const [year, month, day] = b.date.split('-').map(Number)
        const [hour, minute] = b.slot.split(':').map(Number)
        // build a basic YYYYMMDDTHHMM00 format (not converting timezone)
        const pad = (n: number) => String(n).padStart(2, '0')
        const dtstart = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00`
        // assume slot duration 30 minutes
        const dt = new Date(year, month - 1, day, hour, minute + 30)
        const dtend = `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
        return `BEGIN:VEVENT
UID:${b.bookingId || `${Date.now()}-${i}`}@booking
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${b.deviceName || b.deviceId} - ${eventTitle}
DESCRIPTION:Booking for ${b.deviceName || b.deviceId}
END:VEVENT`
      })
      .join('\n')

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Gharieni//Booking//EN
CALSCALE:GREGORIAN
${icsEvents}
END:VCALENDAR`

    await transporter.sendMail({
      from,
      to: email,
      subject: `Booking confirmation — ${eventTitle}`,
      html,
      attachments: [
        {
          filename: 'bookings.ics',
          content: ics,
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        },
      ],
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send-booking error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

