export function typingElsewhere(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el || el.closest('#editor-container')) return false;
  return !!el.closest('#ai-panel, input, textarea, [contenteditable="true"]');
}
