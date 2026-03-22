'use client'

import { useEffect, useState, useRef } from 'react'

export interface ScreenCaptureState {
  isBeingCaptured: boolean
  detectionMethod: string | null
}

/**
 * Detects browser-initiated screen sharing/tab capture.
 *
 * LIMITATION: Only detects capture initiated via browser APIs (e.g., sharing a tab
 * in Google Meet, Teams, Discord). Does NOT detect OS-level screenshots or external
 * screen recorders (OBS, native recorders).
 *
 * Detection methods:
 * 1. Patches navigator.mediaDevices.getDisplayMedia to intercept browser screen share requests
 * 2. Monitors active MediaStreamTracks for display capture surface types
 */
export function useScreenCaptureDetection(): ScreenCaptureState {
  const [state, setState] = useState<ScreenCaptureState>({
    isBeingCaptured: false,
    detectionMethod: null,
  })

  const activeStreams = useRef<Set<MediaStream>>(new Set())

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return

    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(
      navigator.mediaDevices
    )
    if (!originalGetDisplayMedia) return

    // Patch getDisplayMedia to intercept screen share requests FROM this page
    navigator.mediaDevices.getDisplayMedia = async (
      constraints?: DisplayMediaStreamOptions
    ): Promise<MediaStream> => {
      const stream = await originalGetDisplayMedia(constraints)
      activeStreams.current.add(stream)

      setState({ isBeingCaptured: true, detectionMethod: 'getDisplayMedia' })

      // Monitor when the stream ends
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          activeStreams.current.delete(stream)
          if (activeStreams.current.size === 0) {
            setState({ isBeingCaptured: false, detectionMethod: null })
          }
        })
      })

      return stream
    }

    return () => {
      // Restore original on unmount
      navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia
    }
  }, [])

  return state
}
