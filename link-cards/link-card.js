/**
 * 링크 카드 임베드 관리
 */
class LinkCardManager {
  constructor() {
    this.cards = Array.from(document.querySelectorAll('.link-card'))
    this.init()
  }

  init() {
    this.setupClickHandlers()
  }

  setupClickHandlers() {
    this.cards.forEach(card => {
      const url = card.getAttribute('data-url')
      if (url) {
        card.addEventListener('click', () => {
          window.open(url, '_blank', 'noopener,noreferrer')
        })
        card.style.cursor = 'pointer'
      }
    })
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  new LinkCardManager()
})

