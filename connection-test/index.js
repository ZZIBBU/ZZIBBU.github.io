import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const connectionStatusEl = document.querySelector('#connection-status')
const configForm = document.querySelector('#config-form')
const clearConfigBtn = document.querySelector('#clear-config')
const calendarGrid = document.querySelector('#calendar-grid')
const monthLabel = document.querySelector('#month-label')
const prevMonthBtn = document.querySelector('#prev-month')
const nextMonthBtn = document.querySelector('#next-month')
const selectedDateLabel = document.querySelector('#selected-date-label')
const eventList = document.querySelector('#event-list')
const eventForm = document.querySelector('#event-form')
const diaryForm = document.querySelector('#diary-form')
const diaryList = document.querySelector('#diary-list')
const supabaseUrlInput = document.querySelector('#supabase-url')
const supabaseKeyInput = document.querySelector('#supabase-key')

const localConfigKey = 'haezzi-widget-config'
let supabase = null

const today = new Date()

const state = {
  month: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDate: today,
  events: [],
  diaries: [],
  mode: 'disconnected'
}

function formatDate(date) {
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}

function shiftDay(base, days) {
  const copy = new Date(base)
  copy.setDate(copy.getDate() + days)
  return formatDate(copy)
}

function setStatus(text, variant = 'offline') {
  connectionStatusEl.textContent = text
  connectionStatusEl.className = `status ${variant}`
}

function loadConfig() {
  const stored = localStorage.getItem(localConfigKey)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch (error) {
    console.error('Invalid config', error)
    return null
  }
}

function saveConfig(config) {
  localStorage.setItem(localConfigKey, JSON.stringify(config))
}

function clearConfig() {
  localStorage.removeItem(localConfigKey)
  supabase = null
  state.mode = 'disconnected'
  supabaseUrlInput.value = ''
  supabaseKeyInput.value = ''
  setConnectedState(false, 'Supabase 연결 필요')
  loadAndRender()
}

function initFromConfig() {
  const config = loadConfig()
  if (config) {
    supabaseUrlInput.value = config.url
    supabaseKeyInput.value = config.key
    connectSupabase(config)
    return
  }

  setConnectedState(false, 'Supabase 연결 필요')
  loadAndRender()
}

function connectSupabase({ url, key }) {
  if (!url || !key) {
    setConnectedState(false, 'Supabase 연결 필요')
    return
  }
  supabase = createClient(url, key)
  state.mode = 'online'
  setConnectedState(true, 'Supabase 연결됨')
  loadAndRender()
}

function setConnectedState(isConnected, message) {
  setStatus(message, isConnected ? 'online' : 'offline')
  const shouldDisable = !isConnected
  const forms = [eventForm, diaryForm]
  forms.forEach((form) => {
    Array.from(form.elements).forEach((el) => {
      if (el instanceof HTMLElement) {
        el.disabled = shouldDisable
      }
    })
  })
}

function buildMonthDays(month) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const startDay = new Date(firstDay)
  startDay.setDate(1 - ((firstDay.getDay() + 6) % 7))
  const days = []
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(startDay)
    current.setDate(startDay.getDate() + i)
    days.push(current)
  }
  return days
}

async function loadAndRender() {
  if (!supabase) {
    state.events = []
    state.diaries = []
    renderCalendar()
    renderEvents()
    renderDiaries()
    return
  }

  await Promise.all([loadEvents(), loadDiaries()])
  renderCalendar()
  renderEvents()
  renderDiaries()
}

async function loadEvents() {
  const start = new Date(state.month)
  const end = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0)

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('event_date', formatDate(start))
    .lte('event_date', formatDate(end))
    .order('event_date', { ascending: true })

  if (error) {
    console.error(error)
    supabase = null
    state.mode = 'disconnected'
    state.events = []
    setConnectedState(false, 'Supabase 연결 오류 - 재설정 필요')
    return
  }

  state.events = data || []
}

async function loadDiaries() {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .limit(20)

  if (error) {
    console.error(error)
    supabase = null
    state.mode = 'disconnected'
    state.diaries = []
    setConnectedState(false, 'Supabase 연결 오류 - 재설정 필요')
    return
  }

  state.diaries = data || []
}

function renderCalendar() {
  monthLabel.textContent = `${state.month.getFullYear()}년 ${state.month.getMonth() + 1}월`
  const days = buildMonthDays(state.month)
  calendarGrid.innerHTML = ''
  const markers = getCalendarMarkers()

  days.forEach((day) => {
    const dateStr = formatDate(day)
    const isToday = dateStr === formatDate(today)
    const isCurrent = day.getMonth() === state.month.getMonth()
    const isSelected = dateStr === formatDate(state.selectedDate)
    const cell = document.createElement('div')
    cell.className = `day ${isCurrent ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`
    cell.innerHTML = `
      <div class="number">${day.getDate()}</div>
      <div class="dots">${
        [
          ...(Array(markers[dateStr]?.events || 0).fill('<span class="dot event"></span>')),
          ...(Array(markers[dateStr]?.diaries || 0).fill('<span class="dot diary"></span>'))
        ].join('')
      }</div>
    `
    cell.addEventListener('click', () => {
      state.selectedDate = day
      renderCalendar()
      renderEvents()
    })
    calendarGrid.appendChild(cell)
  })
}

function renderEvents() {
  const selected = formatDate(state.selectedDate)
  selectedDateLabel.textContent = `${selected} 일정`
  const eventsByDate = groupByDate(state.events, 'event_date')
  const items = eventsByDate[selected] || []

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
      <h4>${item.title}</h4>
      <p>${item.notes || '메모 없음'}</p>
    `
    eventList.appendChild(li)
  })
}

function renderDiaries() {
  diaryList.innerHTML = ''
  if (!state.diaries.length) {
    const empty = document.createElement('li')
    empty.textContent = '아직 작성된 일기가 없습니다.'
    diaryList.appendChild(empty)
    return
  }

  state.diaries.forEach((entry) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <div class="badge">${entry.entry_date}</div>
      <h4>${entry.title}</h4>
      <p>${entry.content}</p>
    `
    diaryList.appendChild(li)
  })
}

function groupByDate(list, key) {
  return list.reduce((acc, item) => {
    const date = item[key]
    acc[date] = acc[date] || []
    acc[date].push(item)
    return acc
  }, {})
}

function getCalendarMarkers() {
  const markers = {}
  state.events.forEach((item) => {
    const date = item.event_date
    markers[date] = markers[date] || { events: 0, diaries: 0 }
    markers[date].events += 1
  })
  state.diaries.forEach((item) => {
    const date = item.entry_date
    markers[date] = markers[date] || { events: 0, diaries: 0 }
    markers[date].diaries += 1
  })
  return markers
}

async function handleEventSubmit(event) {
  event.preventDefault()

  if (!supabase) {
    alert('Supabase 연결 후 이용해주세요.')
    return
  }

  const formData = new FormData(event.target)
  const payload = {
    event_date: formData.get('eventDate'),
    title: formData.get('eventTitle'),
    notes: formData.get('eventNotes') || ''
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(payload)
    .select()
    .single()

  if (error) {
    alert('Supabase 저장 오류: ' + error.message)
    return
  }

  state.events.push(data)
  event.target.reset()
  const eventDate = new Date(payload.event_date)
  state.selectedDate = eventDate
  state.month = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1)
  renderCalendar()
  renderEvents()
}

async function handleDiarySubmit(event) {
  event.preventDefault()

  if (!supabase) {
    alert('Supabase 연결 후 이용해주세요.')
    return
  }

  const formData = new FormData(event.target)
  const payload = {
    entry_date: formData.get('entryDate'),
    title: formData.get('entryTitle'),
    content: formData.get('entryContent')
  }

  const { data, error } = await supabase
    .from('diary_entries')
    .insert(payload)
    .select()
    .single()

  if (error) {
    alert('Supabase 저장 오류: ' + error.message)
    return
  }

  state.diaries.unshift(data)
  const entryDate = new Date(payload.entry_date)
  state.month = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1)
  state.selectedDate = entryDate
  event.target.reset()
  renderCalendar()
  renderEvents()
  renderDiaries()
}

configForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const formData = new FormData(event.target)
  const url = formData.get('supabaseUrl')
  const key = formData.get('supabaseKey')
  saveConfig({ url, key })
  connectSupabase({ url, key })
})

clearConfigBtn.addEventListener('click', () => {
  clearConfig()
})

eventForm.addEventListener('submit', handleEventSubmit)
diaryForm.addEventListener('submit', handleDiarySubmit)

prevMonthBtn.addEventListener('click', () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1)
  loadAndRender()
})

nextMonthBtn.addEventListener('click', () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1)
  loadAndRender()
})

initFromConfig()
loadAndRender()

window.widgetState = state
