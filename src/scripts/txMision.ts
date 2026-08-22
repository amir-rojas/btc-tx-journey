/**
 * "CASO PRÁCTICO // MISIÓN" mini quiz on the block-explorer tab. Ported from
 * the DCLogic component's `state.{mision,misionFb}` + `startMision`/option
 * `pick` methods into a render-on-change loop, matching the pattern in
 * `txExplorer.ts` since there's no React runtime here.
 */

import { MISION_PASOS } from '../data/txExplorerData';
import { tick } from './txSound';

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initMision(): void {
	const startBtn = document.getElementById('mision-start-btn');
	const panel = document.getElementById('mision-panel');
	const stepLabel = document.getElementById('mision-step-label');
	const textEl = document.getElementById('mision-text');
	const optionsEl = document.getElementById('mision-options');
	const feedbackEl = document.getElementById('mision-feedback');
	if (!startBtn || !panel || !stepLabel || !textEl || !optionsEl || !feedbackEl) return;

	let mision = 0;
	let advanceTimer: ReturnType<typeof setTimeout> | undefined;

	const renderStep = () => {
		const idx = Math.min(mision, 3) - 1;
		const step = MISION_PASOS[idx];
		stepLabel.textContent = `PASO ${Math.min(mision, 3)} / 3`;
		textEl.textContent = step.texto;
		optionsEl.innerHTML = step.opciones
			.map((o, i) => `<button class="mision-option" data-opt="${i}">${escapeHtml(o.label)}</button>`)
			.join('');
		optionsEl.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((btn) => {
			btn.addEventListener('click', () => pick(step.opciones[Number(btn.dataset.opt)]));
		});
		feedbackEl.hidden = true;
		feedbackEl.className = 'mision-feedback';
	};

	function pick(o: { ok: boolean; feedback: string }) {
		clearTimeout(advanceTimer);
		if (o.ok) {
			tick(880, 0.1, 0.045);
			feedbackEl!.textContent = o.feedback + (mision < 3 ? '' : ' — Misión completada.');
			feedbackEl!.className = 'mision-feedback ok';
			feedbackEl!.hidden = false;
			if (mision < 3) {
				advanceTimer = setTimeout(() => {
					mision += 1;
					renderStep();
				}, 2600);
			}
		} else {
			tick(220, 0.15, 0.05);
			feedbackEl!.textContent = o.feedback;
			feedbackEl!.className = 'mision-feedback fail';
			feedbackEl!.hidden = false;
		}
	}

	startBtn.addEventListener('click', () => {
		tick(740, 0.08, 0.04);
		mision = 1;
		startBtn.hidden = true;
		panel.hidden = false;
		renderStep();
	});
}
