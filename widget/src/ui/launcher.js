export function createLauncher(onClick) {
  const btn = document.createElement('button')
  btn.id = 'lc-launcher'
  btn.setAttribute('aria-label', 'Open chat')
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
    </svg>
    <span id="lc-unread-badge"></span>
  `
  btn.addEventListener('click', onClick)
  return btn
}

export function setUnreadCount(count) {
  const badge = document.getElementById('lc-unread-badge')
  if (!badge) return
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count)
    badge.style.display = 'flex'
  } else {
    badge.style.display = 'none'
  }
}

export function setLauncherIcon(open) {
  const btn = document.getElementById('lc-launcher')
  if (!btn) return
  if (open) {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    `
  } else {
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
      </svg>
      <span id="lc-unread-badge"></span>
    `
  }
}
