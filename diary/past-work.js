import {
  fetchCalendarEvents,
  formatDate
} from './diary-utils.js'

/**
 * 지난 작업 대시보드
 * 과거 날짜의 작업을 상태별로 표시
 */
class PastWork {
  constructor() {
    this.elements = {
      refreshBtn: document.querySelector('#refresh-btn'),
      pastWorkList: document.querySelector('#past-work-list')
    }

    this.state = {
      events: [],
      filter: 'all'
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
        const filter = e.target.dataset.filter

        // 활성 상태 토글
        document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'))
        e.target.classList.add('active')

        // 필터 상태 업데이트
        this.state.filter = filter
        this.render()
      })
    })
  }

  async loadData() {
    try {
      // 최근 3개월치 일정 로드
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth() - 2, 1)
      const end = new Date(today)
      end.setDate(end.getDate() - 1) // 어제까지
      const fromDate = formatDate(start)
      const toDate = formatDate(end)

      this.state.events = await fetchCalendarEvents({ fromDate, toDate })
      this.render()
    } catch (error) {
      console.error('지난 작업 로딩 실패:', error)
      this.state.events = []
      this.render()
    }
  }

  getTodayDate() {
    return formatDate(this.today)
  }

  filterEvents(events) {
    const today = new Date(this.getTodayDate())

    return events
      .filter((event) => {
        // 과거 날짜만 필터링
        const eventDate = new Date(event.event_date)
        if (formatDate(eventDate) >= this.getTodayDate()) return false

        // 상태 필터
        if (this.state.filter === 'all') return true
        return event.status === this.state.filter
      })
      .sort((a, b) => {
        // 최신순 정렬
        return formatDate(new Date(b.event_date)).localeCompare(formatDate(new Date(a.event_date)))
      })
  }

  render() {
    const filteredEvents = this.filterEvents(this.state.events)

    if (filteredEvents.length === 0) {
      this.elements.pastWorkList.innerHTML = '<div class="work-empty">지난 작업이 없습니다.</div>'
      return
    }

    this.elements.pastWorkList.innerHTML = filteredEvents
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

    return `
      <div class="work-item">
        <div class="work-item-header">
          <div class="work-item-priority" style="background: ${priorityColor}"></div>
          <div class="work-item-title">${event.title || '제목 없음'}</div>
          <span class="work-item-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="work-item-body">
          ${event.assignee ? `<div class="work-item-meta"><span class="work-item-label">의뢰자:</span> ${event.assignee}</div>` : ''}
          <div class="work-item-meta"><span class="work-item-label">날짜:</span> ${month}월 ${day}일 (${weekday})</div>
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
  new PastWork()
})
