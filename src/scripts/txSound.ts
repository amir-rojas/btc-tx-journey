/**
 * Tiny Web Audio tick/chime engine, ported from the DCLogic component's
 * `_audio`/`_tick`/`_chime` methods. Sound-enabled state lives here (not in
 * any one feature module) because the original component's single
 * `state.sound` flag was read by every interaction across tabs — the sim's
 * stage transitions, tab switches, glossary toggles, and explorer follows.
 */

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean): void {
	enabled = v;
}

export function isSoundEnabled(): boolean {
	return enabled;
}

function audio(): AudioContext | null {
	if (!ctx) {
		try {
			const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			ctx = new Ctor();
		} catch {
			return null;
		}
	}
	return ctx;
}

export function primeAudio(): void {
	audio();
}

export function tick(freq = 880, dur = 0.07, gain = 0.045): void {
	if (!enabled) return;
	const ac = audio();
	if (!ac) return;
	if (ac.state === 'suspended') ac.resume();
	const o = ac.createOscillator();
	const g = ac.createGain();
	o.type = 'sine';
	o.frequency.value = freq;
	g.gain.setValueAtTime(gain, ac.currentTime);
	g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
	o.connect(g);
	g.connect(ac.destination);
	o.start();
	o.stop(ac.currentTime + dur);
}

export function chime(): void {
	[523, 659, 784].forEach((f, i) => setTimeout(() => tick(f, 0.3, 0.05), i * 100));
}
