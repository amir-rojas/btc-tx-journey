/**
 * Page chrome shared across all three tabs: the fixed top nav's tab
 * switching (`_setView` in the DC source) and the glossary accordion
 * (single-open, like the source's `state.gl` index).
 */

import { tick } from './txSound';

const VIEWS = ['viaje', 'explorador', 'fund'] as const;
type View = (typeof VIEWS)[number];

export function initChrome(): void {
	const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
	const viewEls: Record<View, HTMLElement | null> = {
		viaje: document.getElementById('view-viaje'),
		explorador: document.getElementById('view-explorador'),
		fund: document.getElementById('view-fund'),
	};

	const setView = (v: View) => {
		VIEWS.forEach((key) => viewEls[key]?.classList.toggle('active', key === v));
		tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === v));
		window.scrollTo({ top: 0, behavior: 'auto' });
		tick(700, 0.06, 0.03);
	};

	tabs.forEach((b) => {
		const v = b.dataset.tab as View;
		b.addEventListener('click', () => setView(v));
	});
	document.querySelectorAll<HTMLElement>('[data-goto-view]').forEach((el) => {
		const v = el.dataset.gotoView as View;
		el.addEventListener('click', () => setView(v));
	});

	document.querySelectorAll<HTMLButtonElement>('.gloss-card').forEach((card) => {
		card.addEventListener('click', () => {
			const opening = !card.classList.contains('open');
			document.querySelectorAll('.gloss-card.open').forEach((other) => {
				if (other !== card) other.classList.remove('open');
			});
			card.classList.toggle('open', opening);
			tick(opening ? 740 : 520, 0.06, 0.03);
		});
	});
}
