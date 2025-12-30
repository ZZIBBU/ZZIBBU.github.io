import {
  bootstrapConfig,
  fetchDiaries,
  formatDate,
  getSupabaseClient,
  setStatus,
  storeDiary,
  shiftDay
} from './diary-utils.js'

const connectionStatusEl = document.querySelector('#connection-status')
const entrySlots = {
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
const todayDateText = document.querySelector('#today-date strong')
const diaryForm = document.querySelector('#diary-form')
const writeModeBadge = document.querySelector('#write-mode')
const writeDateText = document.querySelector('[data-write-date]')
const recentDiaryList = document.querySelector('#recent-diary-list')
const pageSheet = document.querySelector('#page-sheet')
const pageSurfaces = Array.from(document.querySelectorAll('[data-page-surface]'))
const turnRightBtn = document.querySelector('#turn-right')
const turnLeftBtn = document.querySelector('#turn-left')
const turnBackBtn = document.querySelector('[data-turn-back]')
const turnForwardButtons = document.querySelectorAll('[data-turn-forward]')

let diaries = []
let isFlipped = false

function formatKoreanDate(date) {
  const d = typeof date === 'string' ? new Date(date) : date
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}월 ${day}일`
}

function findEntryByDate(date) {
  return diaries.find((entry) => entry.entry_date === date) || null
}

function pickRandom(excludedDates = new Set()) {
  const candidates = diaries.filter((entry) => !excludedDates.has(entry.entry_date))
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function setSlotLabel(slot, text) {
  if (slot?.label) {
    slot.label.textContent = text
  }
}

function renderEntrySlot(slot, entryInfo, emptyText, defaultLabel) {
  if (!slot?.body) return
  slot.body.innerHTML = ''
  setSlotLabel(slot, entryInfo?.label || defaultLabel)

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

function resolveSlots() {
  const today = new Date()
  const yesterday = findEntryByDate(shiftDay(today, -1))
  const beforeYesterday = findEntryByDate(shiftDay(today, -2))
  const weekAgo = findEntryByDate(shiftDay(today, -7))
  const monthAgo = findEntryByDate(shiftDay(today, -30))

  const priorCandidates = [
    beforeYesterday && { entry: beforeYesterday, label: 'the day before yesterday' },
    weekAgo && { entry: weekAgo, label: 'a week ago' }
  ].filter(Boolean)
  const prior =
    priorCandidates.length > 0
      ? priorCandidates[Math.floor(Math.random() * priorCandidates.length)]
      : null

  const excluded = new Set([yesterday, prior?.entry].filter(Boolean).map((entry) => entry.entry_date))
  const randomFallback = pickRandom(excluded)

  const monthSlot = monthAgo
    ? { entry: monthAgo, label: 'a month ago' }
    : randomFallback
      ? { entry: randomFallback, label: 'random pick' }
      : null

  return {
    yesterday: yesterday ? { entry: yesterday, label: 'yesterday' } : null,
    prior,
    month: monthSlot
  }
}

function renderDiarySlots() {
  const slots = resolveSlots()
  renderEntrySlot(entrySlots.yesterday, slots.yesterday, '어제 일기가 없습니다.', 'yesterday')
  renderEntrySlot(
    entrySlots.prior,
    slots.prior,
    '그제/일주일 전 일기가 없습니다.',
    'the day before yesterday'
  )
  renderEntrySlot(
    entrySlots.month,
    slots.month,
    '한 달 전 또는 랜덤 일기가 없습니다.',
    slots.month?.label || 'a month ago'
  )
}

function setTodayText() {
  if (todayDateText) {
    todayDateText.textContent = formatKoreanDate(new Date())
  }
}

function renderRecentList() {
  if (!recentDiaryList) return
  recentDiaryList.innerHTML = ''
  if (!diaries.length) {
    const empty = document.createElement('li')
    empty.textContent = '아직 작성된 일기가 없습니다.'
    empty.className = 'muted'
    recentDiaryList.appendChild(empty)
    return
  }

  diaries.slice(0, 5).forEach((entry) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <div class="badge">${entry.entry_date}</div>
      <h4 class="history-title">${entry.title}</h4>
      <p class="muted small">${entry.content}</p>
    `
    recentDiaryList.appendChild(li)
  })
}

function setWritePageDate(date = new Date()) {
  if (writeDateText) {
    writeDateText.textContent = `${formatKoreanDate(date)}의 기록을 남겨보세요.`
  }
}

function syncPageHeight() {
  if (!pageSheet) return
  const faceHeights = pageSurfaces.map((face) => face.offsetHeight).filter(Boolean)
  if (!faceHeights.length) return
  const maxHeight = Math.max(...faceHeights)
  pageSheet.style.height = `${maxHeight}px`
  pageSheet.style.minHeight = `${maxHeight}px`
}

function setButtonState(button, enabled) {
  if (!button) return
  button.disabled = !enabled
  button.setAttribute('aria-disabled', String(!enabled))
  button.classList.toggle('disabled', !enabled)
}

function updatePageButtons() {
  const canTurnForward = !isFlipped
  const canTurnBackward = isFlipped
  setButtonState(turnRightBtn, canTurnForward)
  setButtonState(turnLeftBtn, canTurnBackward)
  setButtonState(turnBackBtn, canTurnBackward)
  turnForwardButtons.forEach((btn) => setButtonState(btn, canTurnForward))
}

function setPageState(turnToWrite) {
  if (!pageSheet || turnToWrite === isFlipped) return
  isFlipped = turnToWrite
  pageSheet.classList.toggle('flipped', isFlipped)
  updatePageButtons()
  syncPageHeight()
}

if (typeof ResizeObserver !== 'undefined' && pageSurfaces.length) {
  const observer = new ResizeObserver(syncPageHeight)
  pageSurfaces.forEach((face) => observer.observe(face))
}

async function loadDiaries() {
  diaries = await fetchDiaries({
    onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
  })

  renderDiarySlots()
  setTodayText()
  renderRecentList()
  setWritePageDate()
  syncPageHeight()
}

async function handleDiarySubmit(event) {
  event.preventDefault()
  const formData = new FormData(event.target)
  const payload = {
    entry_date: formData.get('entryDate'),
    title: formData.get('entryTitle'),
    content: formData.get('entryContent')
  }

  const entry = await storeDiary(payload, {
    onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
  })

  diaries.unshift(entry)
  renderDiarySlots()
  setTodayText()
  renderRecentList()
  setWritePageDate(new Date(payload.entry_date))
  event.target.reset()
  event.target.entryDate.value = formatDate(new Date())
  syncPageHeight()
}

function initConfig() {
  bootstrapConfig({ statusEl: connectionStatusEl })
  if (getSupabaseClient()) {
    setStatus(connectionStatusEl, 'Supabase 연결됨', 'online')
    writeModeBadge?.classList.add('online')
    writeModeBadge.textContent = 'Supabase'
  } else {
    setStatus(connectionStatusEl, '로컬 데모 모드', 'offline')
    writeModeBadge?.classList.remove('online')
    writeModeBadge.textContent = '로컬'
  }
}

diaryForm.addEventListener('submit', handleDiarySubmit)
turnRightBtn?.addEventListener('click', () => setPageState(true))
turnBackBtn?.addEventListener('click', () => setPageState(false))
turnLeftBtn?.addEventListener('click', () => setPageState(false))
turnForwardButtons.forEach((btn) => btn.addEventListener('click', () => setPageState(true)))

document.addEventListener('DOMContentLoaded', () => {
  const today = formatDate(new Date())
  diaryForm.entryDate.value = today
  initConfig()
  setTodayText()
  syncPageHeight()
  loadDiaries()
  updatePageButtons()
})
