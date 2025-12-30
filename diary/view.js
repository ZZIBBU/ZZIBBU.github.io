import {
  bootstrapConfig,
  clearConfig,
  connectSupabase,
  fetchDiaries,
  formatDate,
  getSupabaseClient,
  saveConfig,
  setStatus,
  shiftDay
} from './diary-utils.js'

const connectionStatusEl = document.querySelector('#connection-status')
const configForm = document.querySelector('#config-form')
const clearConfigBtn = document.querySelector('#clear-config')
const supabaseUrlInput = document.querySelector('#supabase-url')
const supabaseKeyInput = document.querySelector('#supabase-key')

const modeBadge = document.querySelector('#mode-badge')
const presetButtons = document.querySelectorAll('#preset-buttons button')
const selectedLabel = document.querySelector('#selected-label')
const entryContainer = document.querySelector('#entry-container')
const entryCountBadge = document.querySelector('#entry-count')

let diaries = []
let currentPreset = 'today'

const presets = {
  today: {
    label: '오늘의 일기',
    date: () => formatDate(new Date())
  },
  yesterday: {
    label: '어제의 일기',
    date: () => shiftDay(new Date(), -1)
  },
  week: {
    label: '일주일 전 일기',
    date: () => shiftDay(new Date(), -7)
  },
  month: {
    label: '한 달 전 일기',
    date: () => shiftDay(new Date(), -30)
  },
  random: {
    label: '랜덤 일기',
    date: null
  }
}

function renderEntry(entry) {
  entryContainer.innerHTML = ''

  if (!entry) {
    const empty = document.createElement('div')
    empty.className = 'muted'
    empty.textContent = '해당 기간의 일기가 없습니다.'
    entryContainer.appendChild(empty)
    return
  }

  const card = document.createElement('div')
  card.className = 'list-card'
  card.innerHTML = `
    <div class="badge">${entry.entry_date}</div>
    <h4>${entry.title}</h4>
    <p>${entry.content}</p>
  `

  entryContainer.appendChild(card)
}

function selectPreset(presetKey) {
  currentPreset = presetKey
  selectedLabel.textContent = presets[presetKey].label

  presetButtons.forEach((btn) => {
    btn.classList.toggle('primary', btn.dataset.preset === presetKey)
    btn.classList.toggle('ghost', btn.dataset.preset !== presetKey)
  })

  const entry = pickEntry(presetKey)
  renderEntry(entry)
}

function pickEntry(presetKey) {
  if (presetKey === 'random') {
    const excludedDates = new Set([
      presets.today.date(),
      presets.yesterday.date(),
      presets.week.date(),
      presets.month.date()
    ])
    const candidates = diaries.filter((entry) => !excludedDates.has(entry.entry_date))
    if (!candidates.length) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  const targetDate = presets[presetKey].date()
  return diaries.find((entry) => entry.entry_date === targetDate) || null
}

async function loadDiaries() {
  entryContainer.innerHTML = '<div class="muted">일기를 불러오는 중입니다...</div>'
  diaries = await fetchDiaries({
    onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
  })

  entryCountBadge.textContent = `${diaries.length}개`
  modeBadge.textContent = getSupabaseClient() ? 'Supabase' : '로컬'
  selectPreset(currentPreset)
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
  loadDiaries()
})

clearConfigBtn.addEventListener('click', () => {
  clearConfig({ statusEl: connectionStatusEl, urlInput: supabaseUrlInput, keyInput: supabaseKeyInput })
  modeBadge.textContent = '로컬'
  loadDiaries()
})

presetButtons.forEach((btn) => {
  btn.addEventListener('click', () => selectPreset(btn.dataset.preset))
})

document.addEventListener('DOMContentLoaded', () => {
  initConfig()
  loadDiaries()
})
