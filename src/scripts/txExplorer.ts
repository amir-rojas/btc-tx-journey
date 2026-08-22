/**
 * Block explorer tab ("RASTREAR TX"): search a TXID, follow outputs to the
 * next transaction, breadcrumb trail. Ported from the DCLogic component's
 * `state.{cur,trail,query,notFound}` + `buscar`/`_followTo` methods into a
 * small render-on-change loop, since there's no React runtime here.
 */

import { TXS, DEFAULT_TX_ID, type TxRecord } from '../data/txExplorerData';
import { tick } from './txSound';

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function initExplorer(): void {
	const panel = document.getElementById('tx-panel');
	const trailWrap = document.getElementById('tx-trail-items');
	const input = document.getElementById('tx-search-input') as HTMLInputElement | null;
	const searchBtn = document.getElementById('tx-search-btn');
	const notFoundEl = document.getElementById('tx-notfound');
	if (!panel || !trailWrap || !input || !searchBtn || !notFoundEl) return;

	let cur = DEFAULT_TX_ID;
	let trail = [DEFAULT_TX_ID];

	const renderPanel = (tx: TxRecord) => {
		panel.innerHTML = `
			<div class="tx-panel-head">
				<div class="tx-panel-id">
					<span class="tx-label">TXID</span>
					<span class="tx-id-val">${escapeHtml(tx.id)}</span>
				</div>
				<div class="tx-panel-meta">
					<div class="tx-meta-item"><span class="tx-label">BLOQUE</span><span class="tx-meta-val">${escapeHtml(tx.block)}</span></div>
					<div class="tx-meta-item"><span class="tx-label">CONFIRMACIONES</span><span class="tx-meta-val tx-conf">${escapeHtml(tx.conf)}</span></div>
					<div class="tx-meta-item"><span class="tx-label">FEE</span><span class="tx-meta-val">${escapeHtml(tx.fee)}</span></div>
				</div>
			</div>
			<div class="tx-panel-grid">
				<div class="tx-col">
					<span class="tx-col-label tx-col-in">INPUTS · DE DÓNDE VIENE</span>
					${tx.inputs
						.map(
							(inp) =>
								`<div class="tx-row tx-row-in"><span class="tx-row-addr">${escapeHtml(inp.addr)}</span><span class="tx-row-val">${escapeHtml(inp.val)}</span></div>`
						)
						.join('')}
				</div>
				<div class="tx-col-arrow">→</div>
				<div class="tx-col tx-col-right">
					<span class="tx-col-label tx-col-out">OUTPUTS · A DÓNDE VA</span>
					${tx.outputs
						.map(
							(out) => `
						<div class="tx-row tx-row-out${out.next ? ' tx-row-next' : ''}">
							<div class="tx-row-left">
								<span class="tx-row-addr">${escapeHtml(out.addr)}</span>
								<span class="tx-row-tag${out.next ? ' tx-row-tag-next' : ''}">${escapeHtml(out.tag)}</span>
							</div>
							<div class="tx-row-right">
								<span class="tx-row-val">${escapeHtml(out.val)}</span>
								${out.next ? `<button class="tx-follow-btn" data-follow="${escapeHtml(out.next)}">SEGUIR →</button>` : ''}
							</div>
						</div>`
						)
						.join('')}
				</div>
			</div>
			<div class="tx-note"><span class="tx-note-label">ANALISTA:</span> ${escapeHtml(tx.nota)}</div>
		`;
		panel.querySelectorAll<HTMLButtonElement>('[data-follow]').forEach((btn) => {
			btn.addEventListener('click', () => followTo(btn.dataset.follow as string));
		});
	};

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
		renderPanel(TXS[cur]);
		renderTrail();
	};

	function followTo(id: string) {
		cur = id;
		trail = trail.includes(id) ? trail.slice(0, trail.indexOf(id) + 1) : [...trail, id];
		notFoundEl!.hidden = true;
		tick(760, 0.07, 0.035);
		renderAll();
	}

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
