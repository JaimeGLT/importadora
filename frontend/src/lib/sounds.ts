let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioContext
}

export function playAlertBeep() {
  try {
    const ctx = getAudioContext()
    const times = [0, 0.1, 0.2, 0.3, 0.4]

    times.forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = t < 0.3 ? 440 : 880
      osc.type = 'square'
      gain.gain.setValueAtTime(0.15, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.08)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.08)
    })
  } catch {
    // silently fail if audio not supported
  }
}

export function playConfirmBeep() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 660
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // silently fail if audio not supported
  }
}
