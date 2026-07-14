import { useCallback, useRef } from 'react'

interface SoundOptions {
  frequency?: number
  duration?: number
  type?: OscillatorType
}

export function useSoundAlert() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }, [])

  const playBeep = useCallback((options: SoundOptions = {}) => {
    const { frequency = 880, duration = 200, type = 'sine' } = options
    try {
      const ctx = getCtx()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration / 1000)
    } catch {
      // Silently fail if audio context not available
    }
  }, [getCtx])

  const playAlertSequence = useCallback(() => {
    playBeep({ frequency: 880, duration: 150 })
    setTimeout(() => playBeep({ frequency: 880, duration: 150 }), 200)
    setTimeout(() => playBeep({ frequency: 1100, duration: 300 }), 400)
  }, [playBeep])

  return { playBeep, playAlertSequence }
}