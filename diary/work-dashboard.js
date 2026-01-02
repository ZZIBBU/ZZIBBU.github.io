import {
  fetchCalendarEvents,
  formatDate
} from './diary-utils.js'

/**
 * 작업 대시보드
 * 오늘, 이번주, 지난 작업을 상태별로 표시
 */
class WorkDashboard {
  constructor() {
    this.elements = {
      refreshBtn: document.querySelector('#refresh-btn'),
      todayTomorrowList: document.querySelector('#today-tomorrow-list'),
      weekList: document.querySelector('#week-list'),
      todayTomorrowCount: document.querySelector('#today-tomorrow-count'),
      weekCount: document.querySelector('#week-count')
    }

    this.state = {
      events: [],
      filters: {
        todayTomorrow: 'all',
        week: 'all'
      }
    }

    this.today = new Date()
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.loadData()
  }

  setupEventListeners() {
    // 새로고침 버튼
    this.elements.refreshBtn?.addEventListener('click', () => this.loadData())

    // 필터 버튼
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const section = e.target.closest('.work-section')
        const filter = e.target.dataset.filter
        const sectionId = section?.id || this.getSectionId(section)

        // 활성 상태 토글
        section?.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'))
        e.target.classList.add('active')

        // 필터 상태 업데이트
        if (sectionId === 'today-tomorrow') {
          this.state.filters.todayTomorrow = filter
        } else if (sectionId === 'week') {
          this.state.filters.week = filter
        }

        this.render()
      })
    })
  }

  getSectionId(section) {
    if (!section) return ''
    const header = section.querySelector('.work-section-header h3')
    if (header?.textContent.includes('오늘/내일')) return 'today-tomorrow'
    if (header?.textContent.includes('이번주')) return 'week'
    return ''
  }

  async loadData() {
    try {
      // 최근 3개월치 일정 로드
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0)
      const fromDate = formatDate(start)
      const toDate = formatDate(end)

      this.state.events = await fetchCalendarEvents({ fromDate, toDate })
      this.render()
    } catch (error) {
      console.error('작업 로딩 실패:', error)
      this.state.events = []
      this.render()
    }
  }

  getTodayDate() {
    return formatDate(this.today)
  }

  getTomorrowDate() {
    const tomorrow = new Date(this.today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return formatDate(tomorrow)
  }

  getWeekStart() {
    const date = new Date(this.today)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1) // 월요일 기준
    return new Date(date.setDate(diff))
  }

  getWeekEnd() {
    const start = this.getWeekStart()
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return end
  }

  filterEvents(events, dateFilter, statusFilter) {
    return events.filter((event) => {
      // 날짜 필터
      const eventDate = new Date(event.event_date)
      const today = new Date(this.getTodayDate())
      const tomorrow = new Date(this.getTomorrowDate())
      const weekStart = this.getWeekStart()
      const weekEnd = this.getWeekEnd()

      let matchesDate = false
      if (dateFilter === 'today-tomorrow') {
        const eventDateStr = formatDate(eventDate)
        matchesDate = eventDateStr === this.getTodayDate() || eventDateStr === this.getTomorrowDate()
      } else if (dateFilter === 'week') {
        matchesDate = eventDate >= weekStart && eventDate <= weekEnd
      }

      if (!matchesDate) return false

      // 상태 필터
      if (statusFilter === 'all') return true
      return event.status === statusFilter
    })
  }

  sortByDatePriority(events) {
    const today = this.getTodayDate()
    const tomorrow = this.getTomorrowDate()
    
    return events.sort((a, b) => {
      const aDate = formatDate(new Date(a.event_date))
      const bDate = formatDate(new Date(b.event_date))
      
      // 오늘이 우선
      if (aDate === today && bDate !== today) return -1
      if (aDate !== today && bDate === today) return 1
      
      // 그 다음 내일
      if (aDate === tomorrow && bDate !== tomorrow) return -1
      if (aDate !== tomorrow && bDate === tomorrow) return 1
      
      // 날짜순 정렬
      return aDate.localeCompare(bDate)
    })
  }

  render() {
    // 오늘/내일 작업 (오늘 우선 정렬)
    const todayTomorrowEvents = this.sortByDatePriority(
      this.filterEvents(
        this.state.events,
        'today-tomorrow',
        this.state.filters.todayTomorrow
      )
    )

    // 이번주 작업
    const weekEvents = this.filterEvents(
      this.state.events,
      'week',
      this.state.filters.week
    )

    // 개수 업데이트
    if (this.elements.todayTomorrowCount) {
      this.elements.todayTomorrowCount.textContent = `${todayTomorrowEvents.length}개`
    }
    if (this.elements.weekCount) {
      this.elements.weekCount.textContent = `${weekEvents.length}개`
    }

    // 목록 렌더링
    this.renderList(this.elements.todayTomorrowList, todayTomorrowEvents)
    this.renderList(this.elements.weekList, weekEvents)
  }

  renderList(container, events) {
    if (!container) return

    if (events.length === 0) {
      container.innerHTML = '<div class="work-empty">작업이 없습니다.</div>'
      return
    }

    container.innerHTML = events
      .map((event) => this.createWorkItem(event))
      .join('')
  }

  createWorkItem(event) {
    const priorityColor = this.getPriorityColor(event.priority || 'medium')
    const statusLabel = this.getStatusLabel(event.status || 'todo')
    const statusClass = this.getStatusClass(event.status || 'todo')
    const date = new Date(event.event_date)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
    const eventDateStr = formatDate(date)
    const today = this.getTodayDate()
    const tomorrow = this.getTomorrowDate()
    
    let dateLabel = `${month}월 ${day}일 (${weekday})`
    if (eventDateStr === today) {
      dateLabel = `오늘 (${month}월 ${day}일)`
    } else if (eventDateStr === tomorrow) {
      dateLabel = `내일 (${month}월 ${day}일)`
    }

    return `
      <div class="work-item">
        <div class="work-item-header">
          <div class="work-item-priority" style="background: ${priorityColor}"></div>
          <div class="work-item-title">${event.title || '제목 없음'}</div>
          <span class="work-item-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="work-item-body">
          ${event.assignee ? `<div class="work-item-meta"><span class="work-item-label">의뢰자:</span> ${event.assignee}</div>` : ''}
          <div class="work-item-meta"><span class="work-item-label">날짜:</span> ${dateLabel}</div>
          ${event.notes ? `<div class="work-item-notes">${event.notes}</div>` : ''}
        </div>
      </div>
    `
  }

  getPriorityColor(priority) {
    const colors = {
      low: '#10b981',
      medium: '#3b82f6',
      high: '#f59e0b',
      urgent: '#ef4444'
    }
    return colors[priority] || colors.medium
  }

  getStatusLabel(status) {
    const labels = {
      todo: '할 일',
      in_progress: '진행 중',
      done: '완료',
      cancelled: '취소'
    }
    return labels[status] || '할 일'
  }

  getStatusClass(status) {
    const classes = {
      todo: 'status-todo',
      in_progress: 'status-progress',
      done: 'status-done',
      cancelled: 'status-cancelled'
    }
    return classes[status] || 'status-todo'
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  new WorkDashboard()
})
