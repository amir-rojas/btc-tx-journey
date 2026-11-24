/**
 * Page chrome shared across all three tabs: the fixed top nav's tab
 * switching (`_setView` in the DC source), the BTC/ETH network switch and the
 * glossary accordion (single-open, like the source's `state.gl` index).
 */

import { tick } from './txSound';

const VIEWS = ['viaje', 'explorador', 'fund'] as const;
type View = (typeof VIEWS)[number];

export type Net = 'btc' | 'eth';
const NET_KEY = 'tx-net';

// Nets each view is available on. Net-specific views (CLUSTERING: btc,
// MEV: eth) go here too; see the convention documented in Nav.astro.
const VIEW_NETS: Record<View, Net[]> = {
	viaje: ['btc', 'eth'],
	explorador: ['btc', 'eth'],
	fund: ['btc', 'eth'],
};

// Tiny net store. <html data-net> mirrors it (also set early by an inline
// script in Layout.astro to avoid a flash) and CSS keys off that attribute.
let net: Net = document.documentElement.dataset.net === 'eth' ? 'eth' : 'btc';
const netListeners = new Set<(n: Net) => void>();

export const getNet = (): Net => net;

/** Subscribe to net changes; returns an unsubscribe function. */
export function onNetChange(fn: (n: Net) => void): () => void {
	netListeners.add(fn);
	return () => netListeners.delete(fn);
}

function setNet(n: Net): void {
	if (n === net) return;
	net = n;
	document.documentElement.dataset.net = n;
	try {
		localStorage.setItem(NET_KEY, n);
	} catch {
		/* storage unavailable: net just won't persist */
	}
	netListeners.forEach((fn) => fn(n));
}

export function initChrome(): void {
	const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
	const viewEls: Record<View, HTMLElement | null> = {
		viaje: document.getElementById('view-viaje'),
		explorador: document.getElementById('view-explorador'),
		fund: document.getElementById('view-fund'),
	};

	let current: View = 'viaje';

	const setView = (v: View) => {
		const changed = v !== current;
		current = v;
		VIEWS.forEach((key) => viewEls[key]?.classList.toggle('active', key === v));
		// replay the entry animation on the incoming view (CSS decides where it runs)
		const el = viewEls[v];
		if (changed && el) {
			el.classList.remove('tx-view-enter');
			void el.offsetWidth; // restart the animation
			el.classList.add('tx-view-enter');
			el.addEventListener('animationend', () => el.classList.remove('tx-view-enter'), { once: true });
		}
		tabs.forEach((b) => b.classList.toggle('active', b.dataset.tab === v));
		// the tab strip scrolls sideways on narrow phones: keep the active tab in view
		const activeTab = tabs.find((b) => b.dataset.tab === v);
		const strip = activeTab?.parentElement;
		if (activeTab && strip && strip.scrollWidth > strip.clientWidth) {
			const a = activeTab.getBoundingClientRect();
			const r = strip.getBoundingClientRect();
			strip.scrollTo({ left: strip.scrollLeft + a.left - r.left - (r.width - a.width) / 2, behavior: 'smooth' });
		}
		window.scrollTo({ top: 0, behavior: 'auto' });
		tick(700, 0.06, 0.03);
	};

	const netBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-net-btn]')];
	const syncNetToggle = (n: Net) => {
		document.querySelectorAll<HTMLButtonElement>('.tx-net-btn').forEach((b) => {
			const on = b.dataset.netBtn === n;
			b.classList.toggle('active', on);
			b.setAttribute('aria-pressed', String(on));
		});
	};
	netBtns.forEach((b) => b.addEventListener('click', () => setNet(b.dataset.netBtn as Net)));
	onNetChange((n) => {
		syncNetToggle(n);
		// land on a view that exists on this net
		setView(VIEW_NETS[current].includes(n) ? current : 'viaje');
	});
	syncNetToggle(net);

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
