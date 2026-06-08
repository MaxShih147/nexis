import { onBeforeUnmount, onMounted } from 'vue'

function isElementWithin(target, container) {
  return target instanceof Node
    && container instanceof Element
    && (container === target || container.contains(target))
}

export function usePopoverOutsideCloseExceptions({
  popoverRef,
  ignoreElements = [],
}) {
  function resolveIgnoredElements() {
    return ignoreElements
      .map(getter => getter?.())
      .filter(Boolean)
  }

  function handleDocumentClick(event) {
    const target = event.target
    if (!(target instanceof Node))
      return

    const popover = popoverRef.value
    if (!popover?.visible)
      return

    if (isElementWithin(target, popover.container))
      return

    for (const element of resolveIgnoredElements()) {
      if (isElementWithin(target, element))
        return
    }

    popover.hide?.()
  }

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick, true)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick, true)
  })
}
