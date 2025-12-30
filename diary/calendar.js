import {
  bootstrapConfig,
  clearConfig,
  connectSupabase,
  deleteCalendarEvent,
  fetchCalendarEvents,
  fetchDiaryMarkers,
  formatDate,
  getSupabaseClient,
  saveConfig,
  setStatus,
  storeCalendarEvent
} from './diary-utils.js'

const connectionStatusEl = document.querySelector('#connection-status')
const configForm = document.querySelector('#config-form')
const clearConfigBtn = document.querySelector('#clear-config')
const supabaseUrlInput = document.querySelector('#supabase-url')
const supabaseKeyInput = document.querySelector('#supabase-key')

const calendarGrid = document.querySelector('#calendar-grid')
const monthLabel = document.querySelector('#month-label')
const prevMonthBtn = document.querySelector('#prev-month')
const nextMonthBtn = document.querySelector('#next-month')
const selectedDateLabel = document.querySelector('#selected-date-label')
const weekdayRow = document.querySelector('#weekday-row')
const diaryStateText = document.querySelector('#diary-state-text')
const modeBadge = document.querySelector('#mode-badge')
const eventList = document.querySelector('#event-list')
const eventCountBadge = document.querySelector('#event-count')
const eventForm = document.querySelector('#event-form')

const today = new Date()

const state = {
  month: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDate: formatDate(today),
  events: [],
  diaryDates: new Set()
}

const weekdays = ['월', '화', '수', '목', '금', '토', '일']

function buildMonthDays(month) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const startDay = new Date(firstDay)
  startDay.setDate(1 - ((firstDay.getDay() + 6) % 7)) // 주 시작을 월요일로 보정
  const days = []
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDay)
    current.setDate(startDay.getDate() + i)
    days.push(current)
  }
  return days
}

function groupByDate(list, key) {
  return list.reduce((acc, item) => {
    const date = item[key]
    acc[date] = acc[date] || []
    acc[date].push(item)
    return acc
  }, {})
}

function renderWeekdays() {
  if (!weekdayRow) return
  weekdayRow.innerHTML = ''
  weekdays.forEach((day) => {
    const span = document.createElement('span')
    span.textContent = day
    weekdayRow.appendChild(span)
  })
}

function renderCalendar() {
  const days = buildMonthDays(state.month)
  const eventsByDate = groupByDate(state.events, 'event_date')
  const diaryDates = state.diaryDates

  monthLabel.textContent = `${state.month.getFullYear()}년 ${state.month.getMonth() + 1}월`
  calendarGrid.innerHTML = ''

  days.forEach((day) => {
    const dateStr = formatDate(day)
    const isToday = dateStr === formatDate(today)
    const isCurrent = day.getMonth() === state.month.getMonth()
    const isSelected = dateStr === state.selectedDate
    const eventCount = eventsByDate[dateStr]?.length || 0
    const hasDiary = diaryDates.has(dateStr)

    const cell = document.createElement('div')
    cell.className = `day ${isCurrent ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`
    const dots = eventCount
      ? Array(Math.min(eventCount, 4))
          .fill('<span class="dot event"></span>')
          .join('')
      : ''

    cell.innerHTML = `
      <div class="number">${day.getDate()}</div>
      <div class="markers">
        <div class="dots">${dots}</div>
        <span class="diary-flag ${hasDiary ? 'done' : 'empty'}">${hasDiary ? '일기 ✔' : '일기 없음'}</span>
      </div>
    `

    cell.addEventListener('click', () => {
      state.selectedDate = dateStr
      renderCalendar()
      renderEvents()
    })

    calendarGrid.appendChild(cell)
  })
}

function renderEvents() {
  const selected = state.selectedDate
  const eventsByDate = groupByDate(state.events, 'event_date')
  const items = eventsByDate[selected] || []
  const hasDiary = state.diaryDates.has(selected)

  selectedDateLabel.textContent = `${selected} 일정`
  diaryStateText.textContent = hasDiary ? '이 날짜는 일기가 작성되었습니다.' : '아직 일기가 없습니다.'
  eventCountBadge.textContent = `${items.length}개`

  eventList.innerHTML = ''
  if (!items.length) {
    const empty = document.createElement('li')
    empty.textContent = '일정이 없습니다.'
    empty.className = 'muted'
    eventList.appendChild(empty)
    return
  }

  items.forEach((item) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <div class="badge">${item.event_date}</div>
      <h4>${item.title}</h4>
      <p class="muted small">${item.notes || '메모 없음'}</p>
    `
    const removeBtn = document.createElement('button')
    removeBtn.className = 'ghost danger'
    removeBtn.textContent = '삭제'
    removeBtn.addEventListener('click', async () => {
      const success = await deleteCalendarEvent(item.id, {
        onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
      })
      if (success) {
        await loadData()
      }
    })
    li.appendChild(removeBtn)
    eventList.appendChild(li)
  })
}

async function loadData() {
  const start = new Date(state.month.getFullYear(), state.month.getMonth(), 1)
  const end = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0)
  const fromDate = formatDate(start)
  const toDate = formatDate(end)

  const [events, diaryDates] = await Promise.all([
    fetchCalendarEvents({
      fromDate,
      toDate,
      onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
    }),
    fetchDiaryMarkers({
      fromDate,
      toDate,
      onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
    })
  ])

  state.events = events
  state.diaryDates = new Set(diaryDates)
  modeBadge.textContent = getSupabaseClient() ? 'Supabase' : '로컬'

  renderCalendar()
  renderEvents()
}

function initConfig() {
  bootstrapConfig({
    statusEl: connectionStatusEl,
    urlInput: supabaseUrlInput,
    keyInput: supabaseKeyInput
  })
  modeBadge.textContent = getSupabaseClient() ? 'Supabase' : '로컬'
}

configForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const formData = new FormData(event.target)
  const url = formData.get('supabaseUrl')
  const key = formData.get('supabaseKey')
  saveConfig({ url, key })
  connectSupabase({ url, key }, connectionStatusEl)
  modeBadge.textContent = 'Supabase'
  loadData()
})

clearConfigBtn.addEventListener('click', () => {
  clearConfig({ statusEl: connectionStatusEl, urlInput: supabaseUrlInput, keyInput: supabaseKeyInput })
  modeBadge.textContent = '로컬'
  loadData()
})

eventForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const formData = new FormData(event.target)
  const payload = {
    event_date: formData.get('eventDate'),
    title: formData.get('eventTitle'),
    notes: formData.get('eventNotes') || ''
  }

  await storeCalendarEvent(payload, {
    onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
  })

  state.selectedDate = payload.event_date
  state.month = new Date(new Date(payload.event_date).getFullYear(), new Date(payload.event_date).getMonth(), 1)
  event.target.reset()
  event.target.eventDate.value = payload.event_date
  // 최신 데이터를 다시 불러와 반영
  await loadData()
})

prevMonthBtn.addEventListener('click', () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1)
  loadData()
})

nextMonthBtn.addEventListener('click', () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1)
  loadData()
})

document.addEventListener('DOMContentLoaded', () => {
  renderWeekdays()
  initConfig()
  state.selectedDate = formatDate(today)
  eventForm.eventDate.value = formatDate(today)
  loadData()
})
