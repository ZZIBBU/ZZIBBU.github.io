import {
  bootstrapConfig,
  clearConfig,
  connectSupabase,
  fetchDiaries,
  formatDate,
  saveConfig,
  storeDiary,
  setStatus,
  getSupabaseClient
} from './diary-utils.js'

const connectionStatusEl = document.querySelector('#connection-status')
const configForm = document.querySelector('#config-form')
const clearConfigBtn = document.querySelector('#clear-config')
const diaryForm = document.querySelector('#diary-form')
const diaryList = document.querySelector('#diary-list')
const modeBadge = document.querySelector('#mode-badge')
const entryCountBadge = document.querySelector('#entry-count')
const supabaseUrlInput = document.querySelector('#supabase-url')
const supabaseKeyInput = document.querySelector('#supabase-key')

let diaries = []
let mode = 'local'

function renderDiaries() {
  diaryList.innerHTML = ''
  if (!diaries.length) {
    const empty = document.createElement('li')
    empty.textContent = '아직 작성된 일기가 없습니다.'
    diaryList.appendChild(empty)
    entryCountBadge.textContent = '0개'
    return
  }

  diaries.forEach((entry) => {
    const li = document.createElement('li')
    li.innerHTML = `
      <div class="badge">${entry.entry_date}</div>
      <h4>${entry.title}</h4>
      <p>${entry.content}</p>
    `
    diaryList.appendChild(li)
  })

  entryCountBadge.textContent = `${diaries.length}개`
}

async function loadDiaries() {
  diaries = await fetchDiaries({
    onError: (msg) => setStatus(connectionStatusEl, msg, 'error')
  })
  mode = getSupabaseClient() ? 'online' : 'local'
  modeBadge.textContent = mode === 'online' ? 'Supabase' : '로컬'
  renderDiaries()
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
  mode = getSupabaseClient() ? 'online' : 'local'
  modeBadge.textContent = mode === 'online' ? 'Supabase' : '로컬'
  renderDiaries()
  event.target.reset()
  event.target.entryDate.value = formatDate(new Date())
}

function initConfig() {
  const config = bootstrapConfig({
    statusEl: connectionStatusEl,
    urlInput: supabaseUrlInput,
    keyInput: supabaseKeyInput
  })

  mode = getSupabaseClient() ? 'online' : 'local'
  modeBadge.textContent = mode === 'online' ? 'Supabase' : '로컬'
}

configForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const formData = new FormData(event.target)
  const url = formData.get('supabaseUrl')
  const key = formData.get('supabaseKey')
  saveConfig({ url, key })
  connectSupabase({ url, key }, connectionStatusEl)
  mode = 'online'
  modeBadge.textContent = 'Supabase'
  loadDiaries()
})

clearConfigBtn.addEventListener('click', () => {
  clearConfig({ statusEl: connectionStatusEl, urlInput: supabaseUrlInput, keyInput: supabaseKeyInput })
  mode = 'local'
  modeBadge.textContent = '로컬'
  loadDiaries()
})

diaryForm.addEventListener('submit', handleDiarySubmit)

document.addEventListener('DOMContentLoaded', () => {
  const today = formatDate(new Date())
  diaryForm.entryDate.value = today
  initConfig()
  loadDiaries()
})
