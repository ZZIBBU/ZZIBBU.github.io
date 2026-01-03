import {
  fetchDiaries,
  formatDate,
  storeDiary,
  shiftDay,
  fetchCalendarEvents,
  fetchDiaryMarkers,
  uploadImageToSupabase,
  convertImageToBase64
} from './diary-utils.js'

/**
 * Book 페이지 메인 클래스
 * 일기 보기/쓰기 기능을 관리
 */
class BookPage {
  constructor() {
    // DOM 요소
    this.elements = {
      pageSheet: document.querySelector('#page-sheet'),
      pageSurfaces: Array.from(document.querySelectorAll('[data-page-surface]')),
      turnRightBtn: document.querySelector('#turn-right'),
      turnLeftBtn: document.querySelector('#turn-left'),
      writePagesContainer: document.querySelector('#write-pages-container'),
      todayDateText: document.querySelector('#today-date strong'),
      diaryForm: document.querySelector('#diary-form'),
      calendarSlot: document.querySelector('[data-slot="calendar"]'),
      imageInput: document.querySelector('#entry-image-input'),
      imagePreview: document.querySelector('#image-preview'),
      imagePreviewContainer: document.querySelector('#image-preview-container'),
      removeImageBtn: document.querySelector('#remove-image-btn'),
      diaryImageSlot: document.querySelector('[data-slot="diary-image"]'),
      topBannerSlot: document.querySelector('[data-slot="top-banner"]'),
      stackLeftSlot: document.querySelector('[data-slot="stack-left"]'),
      bottomRightSlot: document.querySelector('[data-slot="bottom-right"]')
    }

    // 상태
    this.state = {
      diaries: [],
      currentPage: 0, // 0: 1페이지(왼쪽 이미지), 1: 2페이지(오른쪽 일기보기), 2: 3페이지(왼쪽 일기쓰기)
      currentWritePageIndex: 0,
      writePages: [],
      calendar: {
        month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        events: [],
        diaryDates: new Set()
      }
    }

    // 엔트리 슬롯
    this.entrySlots = {
      yesterday: {
        body: document.querySelector('#slot-yesterday .entry-body'),
        label: document.querySelector('#slot-yesterday .label-box')
      },
      prior: {
        body: document.querySelector('#slot-prior .entry-body'),
        label: document.querySelector('#slot-prior .label-box')
      },
      month: {
        body: document.querySelector('#slot-month .entry-body'),
        label: document.querySelector('#slot-month .label-box')
      }
    }

    this.init()
  }

  init() {
    this.setupEventListeners()
    this.setupResizeObserver()
    this.initializeForm()
    this.initializeWritePages()
    this.setInitialPageState()
    this.loadData()
    this.initCalendar()
  }

  setInitialPageState() {
    // 초기 상태: 1페이지(왼쪽 이미지)만 보이도록
    this.state.currentPage = 0
    if (this.elements.pageSheet) {
      this.elements.pageSheet.classList.remove('flipped')
    }
    this.updatePageButtons()
  }

  setupEventListeners() {
    // 페이지 전환 버튼
    this.elements.turnRightBtn?.addEventListener('click', () => this.handleTurnRight())
    this.elements.turnLeftBtn?.addEventListener('click', () => this.handleTurnLeft())

    // 폼 제출
    this.elements.diaryForm?.addEventListener('submit', (e) => this.handleSubmit(e))

    // 이미지 업로드
    this.elements.imageInput?.addEventListener('change', (e) => this.handleImageSelect(e))
    this.elements.removeImageBtn?.addEventListener('click', () => this.removeImage())

    // 키보드 네비게이션
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return
      if (e.key === 'ArrowLeft') this.elements.turnLeftBtn?.click()
      if (e.key === 'ArrowRight') this.elements.turnRightBtn?.click()
    })
  }

  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined' && this.elements.pageSurfaces.length) {
      const observer = new ResizeObserver(() => this.syncPageHeight())
      this.elements.pageSurfaces.forEach((face) => observer.observe(face))
    }
  }

  initializeForm() {
    const form = this.elements.diaryForm
    if (!form) return

    const dateInput = form.querySelector('input[name="entryDate"]')
    if (dateInput) {
      dateInput.value = formatDate(new Date())
    }

    const textarea = form.querySelector('#entry-content-textarea')
    if (textarea) {
      textarea.addEventListener('input', () => this.handleContentInput())
    }
  }

  // ===== 데이터 로딩 =====

  async loadData() {
    try {
      this.state.diaries = await fetchDiaries()
      this.render()
    } catch (error) {
      console.error('일기 로딩 실패:', error)
      this.state.diaries = []
      this.render()
    }
  }

  // ===== 렌더링 =====

  render() {
    this.renderDiarySlots()
    this.renderTodayDate()
    this.renderDiaryImages()
    this.syncPageHeight()
  }

  renderDiarySlots() {
    const slots = this.resolveSlots()
    this.renderEntrySlot(this.entrySlots.yesterday, slots.yesterday, '어제 일기가 없습니다.', 'yesterday')
    this.renderEntrySlot(this.entrySlots.prior, slots.prior, '일기가 없습니다.', 'the day before yesterday')
    this.renderEntrySlot(this.entrySlots.month, slots.month, '일기가 없습니다.', slots.month?.label || 'a month ago')
  }

  renderEntrySlot(slot, entryInfo, emptyText, defaultLabel) {
    if (!slot?.body) return

    slot.body.innerHTML = ''
    this.setSlotLabel(slot, entryInfo?.label || defaultLabel)

    if (!entryInfo?.entry) {
      if (emptyText) {
        const empty = document.createElement('div')
        empty.className = 'muted'
        empty.textContent = emptyText
        slot.body.appendChild(empty)
      }
      return
    }

    const card = document.createElement('div')
    const entry = entryInfo.entry
    card.innerHTML = `
      <div class="badge">${entry.entry_date}</div>
      <h4>${entry.title}</h4>
      <p>${entry.content}</p>
    `
    slot.body.appendChild(card)
  }

  setSlotLabel(slot, labelKey) {
    if (!slot?.label) return

    const labels = {
      'yesterday': '어제',
      'the day before yesterday': '그제',
      'a week ago': '일주일 전',
      'a month ago': '한 달 전',
      'random pick': '랜덤'
    }
    slot.label.textContent = labels[labelKey] || labelKey
  }

  renderTodayDate() {
    if (this.elements.todayDateText) {
      this.elements.todayDateText.textContent = this.formatKoreanDate(new Date())
    }
  }

  // ===== 슬롯 해결 로직 =====

  resolveSlots() {
    const today = new Date()
    const yesterday = this.findEntryByDate(shiftDay(today, -1))
    const beforeYesterday = this.findEntryByDate(shiftDay(today, -2))
    const weekAgo = this.findEntryByDate(shiftDay(today, -7))
    const monthAgo = this.findEntryByDate(shiftDay(today, -30))

    // prior 슬롯: 그제 또는 일주일 전 중 하나
    const priorCandidates = [
      beforeYesterday && { entry: beforeYesterday, label: 'the day before yesterday' },
      weekAgo && { entry: weekAgo, label: 'a week ago' }
    ].filter(Boolean)

    const prior = priorCandidates.length > 0
      ? priorCandidates[Math.floor(Math.random() * priorCandidates.length)]
      : null

    // month 슬롯: 한 달 전 또는 랜덤
    const excluded = new Set([yesterday, prior?.entry].filter(Boolean).map((entry) => entry.entry_date))
    const randomFallback = this.pickRandom(excluded)

    const monthSlot = monthAgo
      ? { entry: monthAgo, label: 'a month ago' }
      : randomFallback
        ? { entry: randomFallback, label: 'random pick' }
        : null

    return {
      yesterday: yesterday ? { entry: yesterday, label: 'yesterday' } : null,
      prior: prior || null,
      month: monthSlot
    }
  }

  findEntryByDate(date) {
    const dateStr = typeof date === 'string' ? date : formatDate(date)
    return this.state.diaries.find((entry) => entry.entry_date === dateStr) || null
  }

  pickRandom(excludedDates = new Set()) {
    const candidates = this.state.diaries.filter((entry) => !excludedDates.has(entry.entry_date))
    if (!candidates.length) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  // ===== 페이지 전환 =====
  // 페이지 구조:
  // 0: 1페이지 왼쪽 (이미지 4개 + 캘린더)
  // 1: 2페이지 오른쪽 (일기 보기 - 어제/그제/랜덤/이미지/음악/날짜)
  // 2: 3페이지 왼쪽 (일기 쓰기 폼) + 4페이지 오른쪽 (내용 계속)

  handleTurnRight() {
    const { currentPage, currentWritePageIndex, writePages } = this.state

    if (currentPage === 0) {
      // 1페이지 → 2페이지 (일기 보기)
      this.state.currentPage = 1
      this.elements.pageSheet?.classList.remove('flipped')
    } else if (currentPage === 1) {
      // 2페이지 → 3페이지 (일기 쓰기)
      this.state.currentPage = 2
      this.state.currentWritePageIndex = 0
      this.elements.pageSheet?.classList.add('flipped')
      this.updateWritePagesVisibility()
    } else if (currentPage === 2) {
      // 3페이지에서 오른쪽 페이지로 이동
      if (currentWritePageIndex < writePages.length - 1) {
        this.navigateWritePage('next')
      }
    }

    this.updatePageButtons()
    this.syncPageHeight()
  }

  handleTurnLeft() {
    const { currentPage, currentWritePageIndex } = this.state

    if (currentPage === 2) {
      // 3페이지에서 왼쪽 페이지로 이동하거나 2페이지로 돌아가기
      if (currentWritePageIndex > 0) {
        this.navigateWritePage('prev')
      } else {
        // 3페이지 첫 화면에서 왼쪽 버튼 → 2페이지로
        this.state.currentPage = 1
        this.elements.pageSheet?.classList.remove('flipped')
      }
    } else if (currentPage === 1) {
      // 2페이지 → 1페이지
      this.state.currentPage = 0
    }

    this.updatePageButtons()
    this.syncPageHeight()
  }

  navigateWritePage(direction) {
    if (!this.state.isFlipped) return

    const { currentWritePageIndex, writePages } = this.state
    const maxIndex = writePages.length - 1

    if (direction === 'next' && currentWritePageIndex < maxIndex) {
      this.state.currentWritePageIndex++
    } else if (direction === 'prev' && currentWritePageIndex > 0) {
      this.state.currentWritePageIndex--
    } else {
      return
    }

    this.updateWritePagesVisibility()
    this.updatePageButtons()
  }

  updateWritePagesVisibility() {
    const { currentWritePageIndex, writePages } = this.state

    writePages.forEach((page, index) => {
      if (!page) return

      if (index === 0) {
        // 첫 페이지 (왼쪽): currentWritePageIndex가 0일 때만 표시
        page.style.display = currentWritePageIndex === 0 ? 'block' : 'none'
      } else {
        // 오른쪽 페이지들: 페어로 표시
        // currentWritePageIndex가 0이면 첫 번째 오른쪽 페이지(index 1) 표시
        // currentWritePageIndex가 1이면 두 번째 오른쪽 페이지(index 2) 표시
        const shouldShow = index === currentWritePageIndex + 1
        page.style.display = shouldShow ? 'block' : 'none'
      }
    })
  }

  updatePageButtons() {
    const { currentPage, currentWritePageIndex, writePages } = this.state

    if (currentPage === 0) {
      // 1페이지: 오른쪽만 활성화
      this.setButtonState(this.elements.turnRightBtn, true)
      this.setButtonState(this.elements.turnLeftBtn, false)
    } else if (currentPage === 1) {
      // 2페이지: 양쪽 모두 활성화
      this.setButtonState(this.elements.turnRightBtn, true)
      this.setButtonState(this.elements.turnLeftBtn, true)
    } else if (currentPage === 2) {
      // 3페이지: 오른쪽 페이지 이동 가능 여부에 따라
      const canGoNext = currentWritePageIndex < writePages.length - 1
      const canGoPrev = currentWritePageIndex > 0
      this.setButtonState(this.elements.turnRightBtn, canGoNext)
      this.setButtonState(this.elements.turnLeftBtn, true) // 항상 2페이지로 돌아갈 수 있음
    }
  }

  setButtonState(button, enabled) {
    if (!button) return
    button.disabled = !enabled
    button.setAttribute('aria-disabled', String(!enabled))
    button.classList.toggle('disabled', !enabled)
  }

  // ===== 일기 작성 =====

  handleContentInput() {
    const textarea = this.elements.diaryForm?.querySelector('#entry-content-textarea')
    if (!textarea) return

    // 실시간으로 내용 분배 (debounce로 성능 최적화)
    clearTimeout(this.contentInputTimeout)
    this.contentInputTimeout = setTimeout(() => {
      this.distributeContentToPages()
    }, 150)
  }

  distributeContentToPages() {
    const textarea = this.elements.diaryForm?.querySelector('#entry-content-textarea')
    if (!textarea || !this.elements.writePagesContainer) return

    // 모든 페이지의 내용을 합쳐서 전체 내용 계산
    let fullContent = textarea.value
    
    // 오른쪽 페이지들의 내용도 합치기
    this.state.writePages.slice(1).forEach((page) => {
      const pageTextarea = page.querySelector('.write-content-textarea')
      if (pageTextarea && pageTextarea.value) {
        fullContent += '\n' + pageTextarea.value
      }
    })

    const firstPage = this.state.writePages[0]
    if (!firstPage) {
      // 첫 페이지가 없으면 초기화
      this.initializeWritePages()
      if (!this.state.writePages[0]) return
    }

    const maxFirstPageHeight = this.getMaxTextareaHeight(firstPage)

    // 임시로 전체 내용을 첫 페이지에 넣어서 높이 측정
    const originalValue = textarea.value
    textarea.value = fullContent
    textarea.style.height = 'auto'
    textarea.style.overflowY = 'visible'
    const textareaScrollHeight = textarea.scrollHeight

    if (textareaScrollHeight > maxFirstPageHeight) {
      // 내용이 많으면 첫 페이지에 제한하고 추가 페이지 생성
      textarea.style.height = `${maxFirstPageHeight}px`
      textarea.style.overflowY = 'hidden'

      // 필요한 만큼 오른쪽 페이지 생성 및 내용 분배
      this.ensureWritePages(fullContent, maxFirstPageHeight)
    } else {
      // 내용이 적으면 첫 페이지에만 표시
      textarea.value = originalValue // 원래 값 복원
      textarea.style.height = `${textareaScrollHeight}px`
      textarea.style.overflowY = 'hidden'

      // 불필요한 추가 페이지 제거
      this.removeExtraPages(1)
      if (this.state.currentWritePageIndex > 0) {
        this.state.currentWritePageIndex = 0
      }
    }

    this.updateWritePagesVisibility()
    this.updatePageButtons()
    this.syncPageHeight()
  }

  ensureWritePages(content, maxFirstPageHeight) {
    const textarea = this.elements.diaryForm?.querySelector('#entry-content-textarea')
    if (!textarea) return

    // 실제 텍스트 높이를 기반으로 계산
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
    const linesPerPage = Math.floor(maxFirstPageHeight / lineHeight)
    const lines = content.split('\n')

    // 필요한 페이지 수 계산 (여유 있게)
    const totalLines = lines.length
    const neededPages = Math.max(2, Math.ceil(totalLines / linesPerPage) + 1)

    // 페이지 생성 (필요한 만큼)
    while (this.state.writePages.length < neededPages && this.state.writePages.length < 10) {
      const pageIndex = this.state.writePages.length
      const isRightPage = pageIndex > 0
      const newPage = this.createWritePage(pageIndex, isRightPage)
      this.elements.writePagesContainer.appendChild(newPage)
      this.state.writePages.push(newPage)

      // textarea 이벤트 리스너 추가
      const pageTextarea = newPage.querySelector('.write-content-textarea')
      if (pageTextarea) {
        pageTextarea.addEventListener('input', () => this.handleAdditionalPageInput(pageIndex))
      }
    }

    // 내용 분배
    this.distributeTextToPages(content, maxFirstPageHeight)
  }

  distributeTextToPages(fullContent, maxFirstPageHeight) {
    const textarea = this.elements.diaryForm?.querySelector('#entry-content-textarea')
    if (!textarea) return

    // 실제 텍스트 높이를 측정하기 위해 임시로 전체 내용 설정
    const originalValue = textarea.value
    textarea.value = fullContent
    textarea.style.height = 'auto'
    textarea.style.overflowY = 'visible'
    const totalScrollHeight = textarea.scrollHeight

    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20
    const linesPerPage = Math.floor(maxFirstPageHeight / lineHeight)
    const lines = fullContent.split('\n')

    // 첫 페이지 내용 설정
    const firstPageLines = lines.slice(0, linesPerPage)
    const firstPageText = firstPageLines.join('\n')
    textarea.value = firstPageText
    textarea.style.height = `${maxFirstPageHeight}px`
    textarea.style.overflowY = 'hidden'

    // 나머지 내용을 오른쪽 페이지들에 분배
    let remainingLines = lines.slice(linesPerPage)
    let pageIndex = 1
    let actualPagesNeeded = 1

    while (remainingLines.length > 0 && pageIndex < this.state.writePages.length) {
      const page = this.state.writePages[pageIndex]
      const pageTextarea = page.querySelector('.write-content-textarea')
      if (!pageTextarea) {
        // 페이지가 없으면 생성
        if (this.state.writePages.length < 10) {
          const newPage = this.createWritePage(this.state.writePages.length, true)
          this.elements.writePagesContainer.appendChild(newPage)
          this.state.writePages.push(newPage)
          
          const newTextarea = newPage.querySelector('.write-content-textarea')
          if (newTextarea) {
            newTextarea.addEventListener('input', () => this.handleAdditionalPageInput(this.state.writePages.length - 1))
          }
          continue
        } else {
          break
        }
      }

      const maxPageHeight = this.getMaxTextareaHeightForRightPage(page)
      const pageLinesPerPage = Math.floor(maxPageHeight / lineHeight)
      const pageLines = remainingLines.slice(0, pageLinesPerPage)
      const pageText = pageLines.join('\n')

      pageTextarea.value = pageText
      pageTextarea.style.height = 'auto'
      const textareaHeight = pageTextarea.scrollHeight

      if (textareaHeight > maxPageHeight) {
        pageTextarea.style.height = `${maxPageHeight}px`
        pageTextarea.style.overflowY = 'hidden'
      } else {
        pageTextarea.style.height = `${textareaHeight}px`
        pageTextarea.style.overflowY = 'hidden'
      }

      remainingLines = remainingLines.slice(pageLinesPerPage)
      actualPagesNeeded++
      pageIndex++

      // 내용이 더 있으면 다음 페이지 필요
      if (remainingLines.length > 0 && pageIndex === this.state.writePages.length && this.state.writePages.length < 10) {
        const newPage = this.createWritePage(this.state.writePages.length, true)
        this.elements.writePagesContainer.appendChild(newPage)
        this.state.writePages.push(newPage)

        const newTextarea = newPage.querySelector('.write-content-textarea')
        if (newTextarea) {
          newTextarea.addEventListener('input', () => this.handleAdditionalPageInput(this.state.writePages.length - 1))
        }
      }
    }

    // 남은 페이지 제거
    this.removeExtraPages(actualPagesNeeded)
  }

  getMaxTextareaHeightForRightPage(pageElement) {
    const pageBody = pageElement.querySelector('.write-page-body')
    if (!pageBody) return 500

    // 오른쪽 페이지는 헤더가 없으므로 더 많은 공간 사용 가능
    const fieldPadding = 40
    return pageBody.offsetHeight - fieldPadding
  }

  handleAdditionalPageInput(pageIndex) {
    const page = this.state.writePages[pageIndex]
    if (!page) return

    const textarea = page.querySelector('.write-content-textarea')
    if (!textarea) return

    const maxPageHeight = this.getMaxTextareaHeightForRightPage(page)
    textarea.style.height = 'auto'
    const textareaHeight = textarea.scrollHeight

    if (textareaHeight > maxPageHeight) {
      textarea.style.height = `${maxPageHeight}px`
      textarea.style.overflowY = 'hidden'

      // 다음 페이지 필요
      if (pageIndex === this.state.writePages.length - 1 && this.state.writePages.length < 10) {
        const nextPage = this.createWritePage(this.state.writePages.length, true)
        this.elements.writePagesContainer.appendChild(nextPage)
        this.state.writePages.push(nextPage)

        const nextTextarea = nextPage.querySelector('.write-content-textarea')
        if (nextTextarea) {
          nextTextarea.addEventListener('input', () => this.handleAdditionalPageInput(this.state.writePages.length - 1))
        }
      }
    } else {
      textarea.style.height = `${textareaHeight}px`
      textarea.style.overflowY = 'hidden'
    }

    this.updatePageButtons()
    this.syncPageHeight()
  }

  createWritePage(pageIndex, isRightPage = false) {
    const pageWrapper = document.createElement('div')
    const pageClass = isRightPage ? 'page-right' : 'page-left'
    pageWrapper.className = `book-page ${pageClass} turning-page write-page-wrapper`
    pageWrapper.setAttribute('data-write-page', pageIndex)
    pageWrapper.style.display = 'none'

    const writePage = document.createElement('div')
    writePage.className = 'write-page'

    if (pageIndex === 0) {
      // 첫 페이지는 폼 포함 (HTML에서 이미 있으므로 이 함수는 호출되지 않음)
      // 하지만 안전을 위해 유지
      writePage.innerHTML = `
        <div class="write-page-body">
          <form id="diary-form" class="form book-form">
            <div class="write-form-header">
              <label class="field">
                <span>날짜</span>
                <input type="date" name="entryDate" required />
              </label>
              <label class="field">
                <span>제목</span>
                <input type="text" name="entryTitle" placeholder="오늘의 키워드" required />
              </label>
            </div>
            <label class="field write-content-field">
              <span>내용</span>
              <textarea name="entryContent" id="entry-content-textarea" rows="8" placeholder="자유롭게 기록하세요..." required></textarea>
            </label>
            <div class="button-row end">
              <button class="primary" type="submit">저장하기</button>
            </div>
          </form>
        </div>
      `
    } else {
      // 추가 페이지는 내용만 (오른쪽 페이지)
      writePage.innerHTML = `
        <div class="write-page-continued">
          <div class="write-page-body">
            <div class="field write-content-field">
              <textarea class="write-content-textarea" data-page="${pageIndex}" placeholder=""></textarea>
            </div>
          </div>
        </div>
      `
    }

    pageWrapper.appendChild(writePage)
    return pageWrapper
  }

  initializeWritePages() {
    if (!this.elements.writePagesContainer) return

    // 첫 페이지는 HTML에 이미 있으므로 찾아서 추가
    const firstPage = this.elements.writePagesContainer.querySelector('[data-write-page="0"]')
    if (firstPage && !this.state.writePages.includes(firstPage)) {
      this.state.writePages = [firstPage]
      firstPage.style.display = 'block'
    } else if (!firstPage) {
      // 첫 페이지가 없으면 기존 페이지들 제거하고 초기화
      this.state.writePages.forEach(page => page.remove())
      this.state.writePages = []
    }

    this.state.currentWritePageIndex = 0
    this.updateWritePagesVisibility()
    this.updatePageButtons()
  }

  removeExtraPages(keepCount) {
    while (this.state.writePages.length > keepCount) {
      const lastPage = this.state.writePages.pop()
      lastPage?.remove()
    }
  }

  getMaxTextareaHeight(pageElement) {
    const pageBody = pageElement.querySelector('.write-page-body')
    if (!pageBody) return 300

    const formHeaderHeight = pageElement.querySelector('.write-form-header') ? 80 : 0
    const buttonRowHeight = pageElement.querySelector('.button-row') ? 60 : 0
    const fieldPadding = 80

    return pageBody.offsetHeight - formHeaderHeight - buttonRowHeight - fieldPadding
  }


  // ===== 유틸리티 =====

  formatKoreanDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date
    const month = d.getMonth() + 1
    const day = d.getDate()
    return `${month}월 ${day}일`
  }

  syncPageHeight() {
    if (!this.elements.pageSheet) return

    const faceHeights = this.elements.pageSurfaces
      .map((face) => face.offsetHeight)
      .filter(Boolean)

    if (!faceHeights.length) return

    const maxHeight = Math.max(...faceHeights)
    this.elements.pageSheet.style.height = `${maxHeight}px`
    this.elements.pageSheet.style.minHeight = `${maxHeight}px`
  }

  // ===== 캘린더 =====

  initCalendar() {
    if (!this.elements.calendarSlot) return

    // 슬롯 레이블 제거
    const label = this.elements.calendarSlot.querySelector('.slot-label')
    if (label) label.remove()

    // 캘린더 컨테이너 생성
    this.elements.calendarSlot.innerHTML = ''
    this.elements.calendarSlot.className = 'image-slot calendar-slot book-calendar'
    
    this.renderCalendar()
    this.loadCalendarData()
  }

  buildMonthDays(month) {
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

  groupByDate(list, key) {
    return list.reduce((acc, item) => {
      const date = item[key]
      acc[date] = acc[date] || []
      acc[date].push(item)
      return acc
    }, {})
  }

  renderCalendar() {
    if (!this.elements.calendarSlot) return

    const { month, events, diaryDates } = this.state.calendar
    const days = this.buildMonthDays(month)
    const eventsByDate = this.groupByDate(events, 'event_date')
    const today = new Date()
    const todayStr = formatDate(today)

    const monthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`
    const weekdays = ['월', '화', '수', '목', '금', '토', '일']

    let html = `
      <div class="book-calendar-header">
        <div class="book-calendar-month">${monthLabel}</div>
      </div>
      <div class="book-calendar-weekdays">
        ${weekdays.map(day => `<span class="book-calendar-weekday">${day}</span>`).join('')}
      </div>
      <div class="book-calendar-grid">
    `

    days.forEach((day) => {
      const dateStr = formatDate(day)
      const isToday = dateStr === todayStr
      const isCurrent = day.getMonth() === month.getMonth()
      const eventCount = eventsByDate[dateStr]?.length || 0
      const hasDiary = diaryDates.has(dateStr)

      const classes = [
        'book-calendar-day',
        isCurrent ? '' : 'muted',
        isToday ? 'today' : ''
      ].filter(Boolean).join(' ')

      const dots = eventCount
        ? Array(Math.min(eventCount, 3))
            .fill('<span class="dot event"></span>')
            .join('')
        : ''

      html += `
        <div class="${classes}">
          <div class="book-calendar-day-number">${day.getDate()}</div>
          <div class="book-calendar-day-markers">
            ${dots}
            ${hasDiary ? '<span class="diary-flag done">✓</span>' : ''}
          </div>
        </div>
      `
    })

    html += '</div>'
    this.elements.calendarSlot.innerHTML = html
  }

  async loadCalendarData() {
    const { month } = this.state.calendar
    const start = new Date(month.getFullYear(), month.getMonth(), 1)
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const fromDate = formatDate(start)
    const toDate = formatDate(end)

    try {
      const [events, diaryDates] = await Promise.all([
        fetchCalendarEvents({ fromDate, toDate }),
        fetchDiaryMarkers({ fromDate, toDate })
      ])

      this.state.calendar.events = events
      this.state.calendar.diaryDates = new Set(diaryDates)
      this.renderCalendar()
    } catch (error) {
      console.error('캘린더 데이터 로딩 실패:', error)
    }
  }

  // ===== 이미지 처리 =====

  handleImageSelect(event) {
    const file = event.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      if (this.elements.imagePreview) {
        this.elements.imagePreview.src = e.target.result
      }
      if (this.elements.imagePreviewContainer) {
        this.elements.imagePreviewContainer.style.display = 'block'
      }
    }
    reader.readAsDataURL(file)
  }

  removeImage() {
    if (this.elements.imageInput) {
      this.elements.imageInput.value = ''
    }
    if (this.elements.imagePreview) {
      this.elements.imagePreview.src = ''
    }
    if (this.elements.imagePreviewContainer) {
      this.elements.imagePreviewContainer.style.display = 'none'
    }
  }

  async handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.target)

    // 모든 페이지의 내용 합치기
    let fullContent = formData.get('entryContent') || ''
    this.state.writePages.slice(1).forEach((page) => {
      const textarea = page.querySelector('.write-content-textarea')
      if (textarea && textarea.value) {
        fullContent += '\n' + textarea.value
      }
    })

    // 이미지 처리
    let imageUrl = null
    const imageFile = formData.get('entryImage')
    if (imageFile && imageFile.size > 0) {
      try {
        // Supabase Storage에 업로드 시도, 실패하면 base64로 저장
        imageUrl = await uploadImageToSupabase(imageFile) || await convertImageToBase64(imageFile)
      } catch (error) {
        console.error('이미지 업로드 실패:', error)
        // base64로 폴백
        imageUrl = await convertImageToBase64(imageFile)
      }
    }

    const payload = {
      entry_date: formData.get('entryDate'),
      title: formData.get('entryTitle'),
      content: fullContent.trim(),
      image_url: imageUrl
    }

    try {
      const entry = await storeDiary(payload)

      this.state.diaries.unshift(entry)
      this.render()
      this.loadCalendarData() // 캘린더도 업데이트

      // 성공 메시지 표시
      const submitBtn = event.target.querySelector('button[type="submit"]')
      const originalText = submitBtn.textContent
      submitBtn.textContent = '저장됨!'
      submitBtn.style.background = '#10b981'

      setTimeout(() => {
        submitBtn.textContent = originalText
        submitBtn.style.background = ''
      }, 2000)

      // 폼 리셋
      event.target.reset()
      const dateInput = event.target.querySelector('input[name="entryDate"]')
      if (dateInput) {
        dateInput.value = formatDate(new Date())
      }
      this.removeImage()

      // 추가 페이지 제거
      this.removeExtraPages(1)
      this.state.currentWritePageIndex = 0
      this.updateWritePagesVisibility()
      this.syncPageHeight()
    } catch (error) {
      console.error('일기 저장 실패:', error)
      alert('일기 저장에 실패했습니다.')
    }
  }

  renderDiaryImages() {
    // 최근 일기 중 이미지가 있는 것들을 찾아서 이미지 슬롯에 표시
    const diariesWithImages = this.state.diaries
      .filter(diary => diary.image_url)
      .slice(0, 4) // 최대 4개

    if (diariesWithImages.length === 0) return

    // diary-image 슬롯 (오른쪽 페이지)
    if (this.elements.diaryImageSlot && diariesWithImages[0]) {
      const label = this.elements.diaryImageSlot.querySelector('.slot-label')
      if (label) label.remove()
      this.elements.diaryImageSlot.innerHTML = ''
      const img = document.createElement('img')
      img.src = diariesWithImages[0].image_url
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'cover'
      img.style.borderRadius = '4px'
      this.elements.diaryImageSlot.appendChild(img)
    }

    // 왼쪽 페이지 이미지 슬롯들
    if (diariesWithImages[1] && this.elements.topBannerSlot) {
      const label = this.elements.topBannerSlot.querySelector('.slot-label')
      if (label) label.remove()
      this.elements.topBannerSlot.innerHTML = ''
      const img = document.createElement('img')
      img.src = diariesWithImages[1].image_url
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'cover'
      img.style.borderRadius = '4px'
      this.elements.topBannerSlot.appendChild(img)
    }

    if (diariesWithImages[2] && this.elements.stackLeftSlot) {
      const label = this.elements.stackLeftSlot.querySelector('.slot-label')
      if (label) label.remove()
      this.elements.stackLeftSlot.innerHTML = ''
      const img = document.createElement('img')
      img.src = diariesWithImages[2].image_url
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'cover'
      img.style.borderRadius = '4px'
      this.elements.stackLeftSlot.appendChild(img)
    }

    if (diariesWithImages[3] && this.elements.bottomRightSlot) {
      const label = this.elements.bottomRightSlot.querySelector('.slot-label')
      if (label) label.remove()
      this.elements.bottomRightSlot.innerHTML = ''
      const img = document.createElement('img')
      img.src = diariesWithImages[3].image_url
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'cover'
      img.style.borderRadius = '4px'
      this.elements.bottomRightSlot.appendChild(img)
    }
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  new BookPage()
})
