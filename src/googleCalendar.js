const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]')
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleIdentity = 'true'
    script.onload = resolve
    script.onerror = () => reject(new Error('Could not load Google Identity Services'))
    document.head.appendChild(script)
  })
}

export async function connectGoogleCalendar(clientId) {
  await loadGoogleIdentity()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPE,
      callback: (response) => response.error ? reject(new Error(response.error)) : resolve(response.access_token),
      error_callback: () => reject(new Error('Google authorization was cancelled')),
    })
    client.requestAccessToken({ prompt: 'consent' })
  })
}

async function googleRequest(token, path, options = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error?.message || `Google Calendar request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

export async function listCalendarEvents(token, timeMin, timeMax) {
  const query = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' })
  const payload = await googleRequest(token, `/calendars/primary/events?${query}`)
  return payload.items || []
}

export function taskEventBody(task) {
  const due = new Date(`${task.due}T12:00:00`)
  due.setDate(due.getDate() + 1)
  const endDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
  return {
    summary: task.title,
    description: `Synced from Tada\nTada task: ${task.id}`,
    start: { date: task.due },
    end: { date: endDate },
    reminders: { useDefault: true },
    extendedProperties: { private: { tadaTaskId: task.id } },
  }
}

export async function createCalendarEvent(token, task) {
  return googleRequest(token, '/calendars/primary/events', { method: 'POST', body: JSON.stringify(taskEventBody(task)) })
}

export async function updateCalendarEvent(token, eventId, task) {
  return googleRequest(token, `/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(taskEventBody(task)) })
}
