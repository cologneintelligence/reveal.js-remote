const RevealRemoteZoom = () => {
  let reveal = null
  let currentZoom = null
  let currentSlideElement = null

  function allowControl() {
    const config = reveal.getConfig()

    return config.controls && config.touch
  }

  function dispatchEnableZoom(focus) {
    if (!isValidFocus(focus)) {
      console.warn('invalid focus parameter for dispatchEnableZoom()'); return
    }

    reveal.dispatchEvent({
      type: 'enable-zoom',
      data: { focus }
    })
  }

  function dispatchDisableZoom() {
    reveal.dispatchEvent({ type: 'disable-zoom' })
  }

  const doubleClickListener = (e) => {
    if (!allowControl()) return

    if (currentZoom !== null) {
      dispatchDisableZoom()
    } else {
      const location = getRelativeLocation({ element: currentSlideElement, event: e })

      dispatchEnableZoom(location)
    }
  }

  function setupForSlideElement(element) {
    if (currentSlideElement !== null) {
      applyZoom(null)
      currentSlideElement.removeEventListener('dblclick', doubleClickListener)
    }

    element.addEventListener('dblclick', doubleClickListener)

    currentSlideElement = element
  }

  function getRelativeLocation({event, element}) {
    const elementLocation = element.getBoundingClientRect()

    const x = Math.round((event.clientX - elementLocation.left) * 100 / (elementLocation.right - elementLocation.left))
    const y = Math.round((event.clientY - elementLocation.top) * 100 / (elementLocation.bottom - elementLocation.top))

    return { x, y }
  }

  function applyZoom(focus) {
    if (focus === null) {
      currentSlideElement.style.transform = ''
      currentZoom = null
    } else {
      if (!isValidFocus(focus)) {
        console.warn('invalid focus parameter for applyZoom()'); return
      }

      const transform = 'scale(2) translate(' + (50 - focus.x) + '%, ' + (50 - focus.y) + '%)'

      currentSlideElement.style.transform = transform
      currentZoom = focus
    }
  }

  function isValidFocus(focus) {
    return typeof focus === 'object' && Number.isInteger(focus.x) && Number.isInteger(focus.y) &&
      focus.x >= 0 && focus.x <= 100 && focus.y >= 0 && focus.y <= 100 && Object.keys(focus).length === 2
  }

  return {
    id: 'remote-zoom',
    init: (initReveal) => {
      reveal = initReveal

      reveal.addEventListener('slidechanged', (e) => setupForSlideElement(e.currentSlide))
      reveal.addEventListener('ready', (e) => setupForSlideElement(e.currentSlide))
      reveal.on('enable-zoom', (e) => applyZoom(e.focus))
      reveal.on('disable-zoom', (e) => applyZoom(null))
      reveal.on('overviewshown', () => dispatchDisableZoom());
    },
    getCurrentZoom: () => currentZoom,
    setCurrentZoom: (focus) => {
      if (focus === null) {
        dispatchDisableZoom()
      } else {
        if (!isValidFocus(focus)) {
          console.warn('invalid focus parameter for setCurrentZoom()'); return
        }

        dispatchEnableZoom(focus)
      }
    }
  }
};
