/**
 * Pure HTML renderer for the BTC explorer panel. Shared by the Astro page
 * (initial server render) and `txExplorer.ts` (re-renders on inspect / follow),
 * so the markup lives in exactly one place. No DOM access here.
 */

import type { TxRecord } from '../data/txExplorerData';

export function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Key identifying one input/output of one TX in the "inspected" set. */
export const rowKey = (txId: string, kind: 'in' | 'out', i: number) => `${txId}|${kind}${i}`;

export function renderPanel(tx: TxRecord, insp: ReadonlySet<string>, sel: string | null): string {
	const total = tx.inputs.length + tx.outputs.length;
	const done =
		tx.inputs.filter((_, i) => insp.has(rowKey(tx.id, 'in', i))).length +
		tx.outputs.filter((_, i) => insp.has(rowKey(tx.id, 'out', i))).length;
	const inspClass = done === total ? ' all' : done ? ' some' : '';

	const inputs = tx.inputs
		.map((inp, i) => {
			const k = rowKey(tx.id, 'in', i);
			const seen = insp.has(k);
			const open = sel === k;
			return `<div class="tx-row tx-row-in${seen ? ' seen' : ''}${open ? ' open' : ''}">
				<button class="tx-row-btn" data-pick="${escapeHtml(k)}">
					<span class="tx-row-main"><span class="tx-row-mark">${seen ? '●' : '○'}</span><span class="tx-row-addr">${escapeHtml(inp.addr)}</span></span>
					<span class="tx-row-val">${escapeHtml(inp.val)}</span>
				</button>
				${open ? `<div class="tx-row-why">${escapeHtml(inp.why)}</div>` : ''}
			</div>`;
		})
		.join('');

	const outputs = tx.outputs
		.map((out, i) => {
			const k = rowKey(tx.id, 'out', i);
			const seen = insp.has(k);
			const open = sel === k;
			return `<div class="tx-row tx-row-out${out.next ? ' tx-row-next' : ''}${seen ? ' seen' : ''}${open ? ' open' : ''}">
				<button class="tx-row-btn tx-row-btn-top" data-pick="${escapeHtml(k)}">
					<span class="tx-row-main tx-row-main-top">
						<span class="tx-row-mark">${seen ? '●' : '○'}</span>
						<span class="tx-row-left">
							<span class="tx-row-addr">${escapeHtml(out.addr)}</span>
							<span class="tx-row-tag${out.next ? ' tx-row-tag-next' : ''}">${escapeHtml(out.tag)}</span>
						</span>
					</span>
					<span class="tx-row-val">${escapeHtml(out.val)}</span>
				</button>
				${
					open
						? `<div class="tx-row-why tx-row-why-out"><span class="tx-row-why-text">${escapeHtml(out.why)}</span>${
								out.next ? `<button class="tx-follow-btn" data-follow="${escapeHtml(out.next)}">SEGUIR ESTE OUTPUT →</button>` : ''
							}</div>`
						: ''
				}
			</div>`;
		})
		.join('');

	return `
		<div class="tx-panel-head">
			<div class="tx-panel-id">
				<span class="tx-label">TXID</span>
				<span class="tx-id-val">${escapeHtml(tx.id)}</span>
			</div>
			<div class="tx-panel-meta">
				<div class="tx-meta-item"><span class="tx-label">BLOQUE</span><span class="tx-meta-val">${escapeHtml(tx.block)}</span></div>
				<div class="tx-meta-item"><span class="tx-label">CONFIRMACIONES</span><span class="tx-meta-val tx-conf">${escapeHtml(tx.conf)}</span></div>
				<div class="tx-meta-item"><span class="tx-label">FEE</span><span class="tx-meta-val">${escapeHtml(tx.fee)}</span></div>
				<div class="tx-meta-item"><span class="tx-label">INSPECCIONADO</span><span class="tx-meta-val tx-insp${inspClass}">${done}/${total}</span></div>
			</div>
		</div>
		<div class="tx-panel-grid">
			<div class="tx-col">
				<span class="tx-col-label tx-col-in">INPUTS · DE DÓNDE VIENE</span>
				${inputs}
			</div>
			<div class="tx-col-arrow">→</div>
			<div class="tx-col tx-col-right">
				<span class="tx-col-label tx-col-out">OUTPUTS · A DÓNDE VA</span>
				${outputs}
			</div>
		</div>
		<div class="tx-note">${
			done === 0
				? '<span class="tx-note-locked">◻ LECTURA DEL ANALISTA BLOQUEADA · inspecciona un input o un output para desbloquearla</span>'
				: `<span class="tx-note-open"><span class="tx-note-label">ANALISTA:</span> ${escapeHtml(tx.nota)}</span>`
		}</div>
	`;
}
