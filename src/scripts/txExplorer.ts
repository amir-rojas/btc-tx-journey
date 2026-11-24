/**
 * Block explorer tab ("RASTREAR TX"): search a TXID, inspect inputs/outputs,
 * follow outputs to the next transaction, breadcrumb trail. Ported from the
 * DCLogic component's `state.{cur,trail,query,notFound,insp,sel}` +
 * `buscar`/`_pick`/`_followTo` methods into a small render-on-change loop,
 * since there's no React runtime here. Markup comes from `txExplorerRender.ts`.
 */

import { TXS, DEFAULT_TX_ID } from '../data/txExplorerData';
import { tick } from './txSound';
import { escapeHtml, renderPanel } from './txExplorerRender';

export function initExplorer(): void {
	const panel = document.getElementById('tx-panel');
	const trailWrap = document.getElementById('tx-trail-items');
	const input = document.getElementById('tx-search-input') as HTMLInputElement | null;
	const searchBtn = document.getElementById('tx-search-btn');
	const notFoundEl = document.getElementById('tx-notfound');
	if (!panel || !trailWrap || !input || !searchBtn || !notFoundEl) return;

	let cur = DEFAULT_TX_ID;
	let trail = [DEFAULT_TX_ID];
	const insp = new Set<string>();
	let sel: string | null = null;

	const renderTrail = () => {
		trailWrap.innerHTML = trail
			.map(
				(id, i) =>
					`<button class="tx-trail-btn${id === cur ? ' current' : ''}" data-jump="${escapeHtml(id)}">${i > 0 ? '→ ' : ''}${escapeHtml(id)}</button>`
			)
			.join('');
		trailWrap.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((btn) => {
			btn.addEventListener('click', () => followTo(btn.dataset.jump as string));
		});
	};

	const renderAll = () => {
		panel.innerHTML = renderPanel(TXS[cur], insp, sel);
		renderTrail();
	};

	function followTo(id: string) {
		cur = id;
		sel = null;
		trail = trail.includes(id) ? trail.slice(0, trail.indexOf(id) + 1) : [...trail, id];
		notFoundEl!.hidden = true;
		tick(760, 0.07, 0.035);
		renderAll();
	}

	function pick(k: string) {
		insp.add(k);
		sel = sel === k ? null : k;
		tick(720, 0.05, 0.03);
		renderAll();
	}

	// One delegated listener: the panel's inner markup is rebuilt on every change.
	panel.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const follow = target.closest<HTMLElement>('[data-follow]');
		if (follow) return followTo(follow.dataset.follow as string);
		const pickEl = target.closest<HTMLElement>('[data-pick]');
		if (pickEl) pick(pickEl.dataset.pick as string);
	});

	const buscar = () => {
		const q = input.value.trim().toLowerCase();
		const hit = Object.keys(TXS).find((k) => q.length >= 3 && k.toLowerCase().startsWith(q.slice(0, 4)));
		if (hit) {
			cur = hit;
			trail = [hit];
			input.value = '';
			notFoundEl.hidden = true;
			tick(760, 0.07, 0.035);
			renderAll();
		} else {
			notFoundEl.hidden = false;
		}
	};

	input.addEventListener('input', () => {
		notFoundEl.hidden = true;
	});
	searchBtn.addEventListener('click', buscar);

	renderAll();
}
