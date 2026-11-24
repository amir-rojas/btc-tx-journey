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

/** "4b3f…a2d1", "4B3F...A2D1" and "4b3fa2d1" all normalise to "4b3fa2d1". */
const normTxid = (s: string) => s.toLowerCase().replace(/[\s.…]/g, '');

/**
 * Practice TXs matching what was typed: a prefix of the shortened id, its
 * "prefix…suffix" form, or a full-length hash that starts and ends like it.
 */
function findTxs(raw: string): string[] {
	const q = normTxid(raw);
	if (!q) return [];
	return Object.keys(TXS).filter((id) => {
		const [head, tail = ''] = id.toLowerCase().split('…');
		return (head + tail).startsWith(q) || (q.length > head.length + tail.length && q.startsWith(head) && q.endsWith(tail));
	});
}

export function initExplorer(): void {
	const panel = document.getElementById('tx-panel');
	const trailWrap = document.getElementById('tx-trail-items');
	const input = document.getElementById('tx-search-input') as HTMLInputElement | null;
	const form = document.getElementById('tx-search') as HTMLFormElement | null;
	const msgEl = document.getElementById('tx-search-msg');
	const samples = [...document.querySelectorAll<HTMLButtonElement>('[data-sample]')];
	if (!panel || !trailWrap || !input || !form || !msgEl) return;

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
		msgEl!.hidden = true;
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

	const showMsg = (text: string) => {
		msgEl.textContent = text;
		msgEl.hidden = false;
	};

	/** Jump to a TX from the search box (starts a fresh trail) and bring the panel into view. */
	const openTx = (id: string) => {
		cur = id;
		sel = null;
		trail = [id];
		input.value = '';
		msgEl.hidden = true;
		highlight([]);
		tick(760, 0.07, 0.035);
		renderAll();
		panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const highlight = (ids: string[]) => {
		const q = input.value.trim();
		samples.forEach((b) => {
			b.classList.toggle('match', ids.includes(b.dataset.sample as string));
			b.classList.toggle('dim', q !== '' && !ids.includes(b.dataset.sample as string));
		});
	};

	const buscar = () => {
		const raw = input.value.trim();
		const q = normTxid(raw);
		if (!q) return showMsg('Escribe un TXID (o sus primeros caracteres) o elige una de las TXs de práctica.');
		const hits = findTxs(raw);
		if (hits.length === 1) return openTx(hits[0]);
		if (hits.length > 1) return showMsg(`Varias TXs empiezan por “${raw}”: elige una de las resaltadas.`);
		if (!/^[0-9a-f]+$/.test(q)) return showMsg('Un TXID solo tiene números y letras de la a a la f.');
		if (q.length === 64)
			return showMsg('Ese parece un TXID real, pero este rastreador es de práctica: solo contiene las 3 TXs de arriba.');
		showMsg(`Ninguna TX de práctica empieza por “${raw}”. Prueba con una de las TXs de práctica.`);
	};

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		buscar();
	});
	// live feedback: highlight the sample TXs the current text matches
	input.addEventListener('input', () => {
		msgEl.hidden = true;
		highlight(input.value.trim() ? findTxs(input.value) : []);
	});
	samples.forEach((b) => b.addEventListener('click', () => openTx(b.dataset.sample as string)));

	renderAll();
}
