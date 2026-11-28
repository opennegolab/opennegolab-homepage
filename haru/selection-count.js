export function selectionCounter(control, label, unit) {
  const badge = document.createElement('span');
  badge.className = 'selection-count';
  badge.setAttribute('aria-hidden', 'true');
  badge.hidden = true;
  control.append(badge);

  return count => {
    badge.textContent = count;
    badge.hidden = count === 0;
    if (count) control.setAttribute('aria-label', label + ', 선택 수량 ' + count + unit);
    else control.removeAttribute('aria-label');
  };
}
