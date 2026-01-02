import {
  fetchCalendarEvents,
  fetchDiaryMarkers,
  formatDate
} from './diary-utils.js'

const calendarGrid = document.querySelector('#calendar-grid')
const monthLabel = document.querySelector('#month-label')
const prevMonthBtn = document.querySelector('#prev-month')
const nextMonthBtn = document.querySelector('#next-month')
const weekdayRow = document.querySelector('#weekday-row')

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
        ${hasDiary ? '<span class="diary-flag done">✓</span>' : ''}
      </div>
    `

    cell.addEventListener('click', () => {
      state.selectedDate = dateStr
      renderCalendar()
    })

    calendarGrid.appendChild(cell)
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
      toDate
    }),
    fetchDiaryMarkers({
      fromDate,
      toDate
    })
  ])

  state.events = events
  state.diaryDates = new Set(diaryDates)

  renderCalendar()
}
prevMonthBtn.addEventListener('click', () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1)
  loadData()
})

nextMonthBtn.addEventListener('click', () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1)
  loadData()
})

// 키보드 네비게이션 지원
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' && !e.target.matches('input, textarea')) {
    prevMonthBtn.click()
  } else if (e.key === 'ArrowRight' && !e.target.matches('input, textarea')) {
    nextMonthBtn.click()
  }
})

document.addEventListener('DOMContentLoaded', () => {
  renderWeekdays()
  state.selectedDate = formatDate(today)
  loadData()
})
