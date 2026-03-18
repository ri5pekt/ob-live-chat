function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function createInlineContactCard({ onSubmit, onSkip }) {
  const card = document.createElement('div')
  card.id = 'lc-contact-card'
  card.className = 'lc-contact-card'

  const title = document.createElement('p')
  title.className = 'lc-contact-card-title'
  title.textContent = 'השאר/י פרטים לעדכון עתידי'
  card.appendChild(title)

  const hint = document.createElement('p')
  hint.className = 'lc-contact-card-hint'
  hint.textContent = 'ניצור איתך קשר גם אם הצ\'אט יסתיים'
  card.appendChild(hint)

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.id = 'lc-contact-name'
  nameInput.className = 'lc-contact-input'
  nameInput.placeholder = 'שם מלא'
  nameInput.maxLength = 255
  card.appendChild(nameInput)

  const emailInput = document.createElement('input')
  emailInput.type = 'email'
  emailInput.id = 'lc-contact-email'
  emailInput.className = 'lc-contact-input'
  emailInput.placeholder = 'your@email.com'
  emailInput.maxLength = 255
  card.appendChild(emailInput)

  const errorMsg = document.createElement('p')
  errorMsg.id = 'lc-contact-error'
  errorMsg.className = 'lc-contact-error'
  card.appendChild(errorMsg)

  const saveBtn = document.createElement('button')
  saveBtn.id = 'lc-contact-save'
  saveBtn.className = 'lc-contact-save-btn'
  saveBtn.textContent = 'שמור פרטים'
  card.appendChild(saveBtn)

  const skipBtn = document.createElement('button')
  skipBtn.id = 'lc-contact-skip'
  skipBtn.className = 'lc-contact-skip-btn'
  skipBtn.textContent = 'דלג'
  card.appendChild(skipBtn)

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim()
    const email = emailInput.value.trim()

    if (!name && !email) {
      errorMsg.textContent = 'נא להזין שם או אימייל'
      return
    }
    if (email && !isValidEmail(email)) {
      errorMsg.textContent = 'כתובת אימייל אינה תקינה'
      return
    }

    saveBtn.disabled = true
    saveBtn.textContent = 'שומר...'
    errorMsg.textContent = ''

    const success = await onSubmit?.({ name: name || null, email: email || null })
    if (!success) {
      saveBtn.disabled = false
      saveBtn.textContent = 'שמור פרטים'
      errorMsg.textContent = 'שגיאה בשמירה, נסה שוב'
      return
    }

    card.innerHTML = `<p class="lc-contact-card-done">✓ הפרטים נשמרו בהצלחה${name ? ' — ' + name : ''}</p>`
    setTimeout(() => {
      card.style.transition = 'opacity 0.3s, max-height 0.3s'
      card.style.opacity = '0'
      card.style.overflow = 'hidden'
      card.style.maxHeight = card.offsetHeight + 'px'
      requestAnimationFrame(() => { card.style.maxHeight = '0' })
      setTimeout(() => card.remove(), 320)
    }, 1800)
  })

  skipBtn.addEventListener('click', () => {
    onSkip?.()
    card.remove()
  })

  return card
}

// kept for backward compat — not used after refactor
export function createContactForm(opts) {
  return createInlineContactCard(opts)
}

export function hideContactPanel() {
  const card = document.getElementById('lc-contact-card')
  if (card) card.remove()
}
