/**
 * LiveRegion — announces the outcome of a long operation to assistive tech.
 *
 * Why it is not a plain `<div role="status">`: an ARIA live region only fires
 * when its CONTENT changes while the region is already in the DOM. Mounting a
 * region that already holds its text — which is what happens here, because the
 * views swap whole branches (loading / error / results) rather than mutating a
 * message in place — announces nothing at all in most screen readers.
 *
 * So this component mounts EMPTY and fills itself on a later commit. That is
 * the change the region needs.
 *
 * 'use client' is prepended to the whole client bundle by tsup.
 */

import React, { useEffect, useState } from 'react'

/** Off-screen but still read: `display: none` would remove it from the a11y tree. */
export const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export interface LiveRegionProps {
  /** Text to announce. Changing it re-announces. */
  message: string
  /** Interrupt the user (errors) instead of waiting for a pause. */
  assertive?: boolean
}

export function LiveRegion({ message, assertive = false }: LiveRegionProps) {
  const [text, setText] = useState('')

  useEffect(() => {
    // One frame's worth of delay is enough for the empty region to be committed
    // first; the message then lands as a content CHANGE, which is what gets read.
    const timer = setTimeout(() => setText(message), 100)
    return () => clearTimeout(timer)
  }, [message])

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={visuallyHidden}
    >
      {text}
    </div>
  )
}

export default LiveRegion
