/**
 * Canvas-driven scroll simulation for the tx journey page.
 *
 * Faithful port of the Claude Design "Viaje de una Transaccion.dc.html"
 * component logic (a DCLogic/React class with refs) into plain DOM +
 * requestAnimationFrame, since this Astro project has no React runtime.
 * The `velocidad` Claude Design editor tweak-knob is dropped; velocity is
 * hardcoded to 1 (its default).
 */

import { chime, isSoundEnabled, primeAudio, setSoundEnabled, tick } from './txSound';

type Pt = { x: number; y: number };
type Node = { x: number; y: number; ph: number };
type Cloud = { ang: number; rad: number; sp: number; sz: number; fee: number };
type ChainItem = { n: number; i: number; mine?: boolean };

export function init(): void {
	const canvas = document.getElementById('tx-canvas') as HTMLCanvasElement | null;
	const sim = document.getElementById('tx-sim');
	const sticky = document.getElementById('tx-sticky');
	if (!canvas || !sim || !sticky) return;

	let monto = 0.005;
	let fee = 12;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);

	const fit = () => {
		const r = canvas.getBoundingClientRect();
		canvas.width = r.width * dpr;
		canvas.height = r.height * dpr;
	};
	fit();
	const ro = new ResizeObserver(fit);
	ro.observe(canvas);

	const overlays = [...sticky.querySelectorAll<HTMLElement>('[data-stage]')];
	const navBtns = [...sticky.querySelectorAll<HTMLButtonElement>('[data-nav]')];
	const navWrap = sticky.querySelector<HTMLElement>('[data-navwrap]');
	const prog = sticky.querySelector<HTMLElement>('[data-prog]');
	const hud = sticky.querySelector<HTMLElement>('[data-hud]');
	const statusEl = sticky.querySelector<HTMLElement>('[data-status]');
	const ticks = [...sticky.querySelectorAll<HTMLElement>('[data-tick]')];
	if (!navWrap || !prog || !hud || !statusEl) return;

	const STATUS: [string, string][] = [
		['FIRMANDO', '#5b8cff'],
		['EN MEMPOOL', '#5b8cff'],
		['SELECCIONADA', '#9d7bff'],
		['MINANDO…', '#f7931a'],
		['EN BLOQUE', '#f7931a'],
		['CONFIRMADA', '#3ddc84'],
	];

	let seed = 7;
	const rnd = () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};

	const nodes: Node[] = Array.from({ length: 14 }, () => ({
		x: 0.12 + 0.76 * rnd(),
		y: 0.24 + 0.56 * rnd(),
		ph: rnd() * 6.28,
	}));
	const edges: [number, number][] = [];
	nodes.forEach((n, i) => {
		const ds = nodes
			.map((m, j) => ({ j, d: (n.x - m.x) ** 2 + (n.y - m.y) ** 2 }))
			.filter((e) => e.j !== i)
			.sort((a, b) => a.d - b.d);
		for (let k = 0; k < 2; k++) {
			const j = ds[k].j;
			if (!edges.some((e) => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) edges.push([i, j]);
		}
	});
	const byX = nodes.map((_, i) => i).sort((a, b) => nodes[a].x - nodes[b].x);
	const cloud: Cloud[] = Array.from({ length: 22 }, () => ({
		ang: rnd() * 6.28,
		rad: 0.5 + rnd() * 0.5,
		sp: 0.3 + rnd() * 0.7,
		sz: 3 + rnd() * 4,
		fee: rnd(),
	}));

	const ORANGE = '#f7931a';
	const GREEN = '#3ddc84';
	const VIOLET = '#9d7bff';
	const GRAY = '#8b8f9c';
	const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
	const sm = (a: number, b: number, x: number) => {
		const tt = clamp((x - a) / (b - a), 0, 1);
		return tt * tt * (3 - 2 * tt);
	};
	const lerp = (a: number, b: number, tt: number) => a + (b - a) * tt;
	const io = (s: number, a: number, b: number, c: number, d: number) => sm(a, b, s) * (1 - sm(c, d, s));
	const mono = (px: number, w?: number) => `${w || 400} ${px}px 'JetBrains Mono',monospace`;
	let lastNav = -1;
	const hex = '0123456789abcdef';
	const rhex = (n: number, t: number, salt: number) => {
		let out = '';
		let sd = salt + Math.floor(t * 14);
		for (let i = 0; i < n; i++) {
			sd = (sd * 16807) % 2147483647;
			out += hex[sd & 15];
		}
		return out;
	};

	const np = (n: Node | Pt, W: number, H: number): Pt => ({ x: n.x * W, y: n.y * H });

	let sSmoothed = 0;
	let raf = 0;
	const VELOCITY = 1;

	const draw = (tms: number) => {
		const t = (tms / 1000) * VELOCITY;
		const W = canvas.width / dpr;
		const H = canvas.height / dpr;
		const MOB = W < 700;
		const range = sim.clientHeight - window.innerHeight;
		const P = clamp((window.scrollY - sim.offsetTop) / range, 0, 1);
		const sTarget = P * 6;
		sSmoothed += (sTarget - sSmoothed) * 0.12;
		const s = sSmoothed;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);

		// DOM sync
		prog.style.width = (P * 100).toFixed(2) + '%';
		navWrap.style.opacity = P > 0.005 && !MOB ? '1' : '0';
		hud.style.opacity = P > 0.005 ? '1' : '0';
		const cur = clamp(Math.floor(s), 0, 5);
		if (cur !== lastNav) {
			navBtns.forEach((b, i) => {
				b.style.color = i === cur ? ORANGE : '#5b5f6b';
				b.style.fontWeight = i === cur ? '700' : '400';
			});
			ticks.forEach((tk, i) => {
				tk.style.height = i === cur ? '100%' : '0';
				tk.style.top = i === cur ? '0' : '50%';
			});
			const st = STATUS[cur];
			statusEl.textContent = st[0];
			statusEl.style.color = st[1];
			statusEl.style.borderColor = st[1] + '66';
			if (lastNav >= 0) {
				cur === 5 ? chime() : tick(600 + cur * 70, 0.07, 0.035);
			}
			lastNav = cur;
		}
		overlays.forEach((el, i) => {
			const o = io(s, i + 0.12, i + 0.32, i + 0.78, i + 0.98);
			el.style.opacity = (i === 5 ? sm(5.12, 5.32, s) : o).toFixed(3);
			el.style.transform = `translateY(${(1 - o) * 10}px)`;
		});

		// camera
		const zoom = 1 + 0.05 * io(s, 3.0, 3.3, 3.9, 4.15);
		ctx.translate(W / 2, H / 2);
		ctx.scale(zoom, zoom);
		ctx.translate(-W / 2, -H / 2);

		// anchors
		const walletC = { x: MOB ? W * 0.5 : W * 0.3, y: MOB ? H * 0.34 : H * 0.42 };
		const poolC = { x: W * 0.5, y: MOB ? H * 0.4 : H * 0.46 };
		const blockHome = { x: MOB ? W * 0.5 : W * 0.76, y: MOB ? H * 0.66 : H * 0.48 };
		const center = { x: W * 0.5, y: H * 0.46 };
		const NR = MOB ? Math.min(W, H) * 0.42 : Math.min(W, H) * 0.34;

		// ---- network ----
		const aNet = io(s, 1.0, 1.3, 3.0, 3.35) + io(s, 4.02, 4.25, 4.62, 4.85);
		if (aNet > 0.01) {
			ctx.lineWidth = 1;
			for (const [i, j] of edges) {
				const A = np(nodes[i], W, H);
				const B = np(nodes[j], W, H);
				ctx.strokeStyle = `rgba(139,143,156,${0.16 * aNet})`;
				ctx.beginPath();
				ctx.moveTo(A.x, A.y);
				ctx.lineTo(B.x, B.y);
				ctx.stroke();
				const ft = (t * 0.25 + nodes[i].ph) % 1;
				const fx = lerp(A.x, B.x, ft);
				const fy = lerp(A.y, B.y, ft);
				ctx.fillStyle = `rgba(91,140,255,${0.5 * aNet})`;
				ctx.fillRect(fx - 1.2, fy - 1.2, 2.4, 2.4);
			}
			for (const n of nodes) {
				const p = np(n, W, H);
				const pu = 0.6 + 0.4 * Math.sin(t * 1.6 + n.ph);
				ctx.fillStyle = `rgba(242,241,237,${0.75 * aNet * pu})`;
				ctx.beginPath();
				ctx.arc(p.x, p.y, 2.6, 0, 6.29);
				ctx.fill();
				ctx.strokeStyle = `rgba(139,143,156,${0.3 * aNet * pu})`;
				ctx.beginPath();
				ctx.arc(p.x, p.y, 6 + 2 * pu, 0, 6.29);
				ctx.stroke();
			}
		}

		// ---- wallet card (stage 1) ----
		const aW = io(s, -1, -0.5, 0.95, 1.25);
		if (aW > 0.01) {
			const cw = MOB ? 260 : 300;
			const ch = 190;
			const x = walletC.x - cw / 2;
			const y = walletC.y - ch / 2;
			ctx.globalAlpha = aW;
			ctx.fillStyle = '#14161b';
			ctx.strokeStyle = 'rgba(242,241,237,.16)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.roundRect(x, y, cw, ch, 4);
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = GRAY;
			ctx.font = mono(10);
			ctx.textAlign = 'left';
			ctx.fillText('WALLET', x + 20, y + 26);
			ctx.fillText('FROM', x + 20, y + 52);
			ctx.fillText('TO', x + 20, y + 92);
			ctx.fillText('AMOUNT', x + 20, y + 132);
			ctx.fillStyle = '#f2f1ed';
			ctx.font = mono(13);
			ctx.fillText('1A1zP1…5QGefi2', x + 20, y + 70);
			ctx.fillText('bc1qxy…w0en3', x + 20, y + 110);
			ctx.fillStyle = ORANGE;
			ctx.font = mono(15, 700);
			ctx.fillText(monto.toFixed(3) + ' BTC', x + 20, y + 152);
			const su = sm(0.12, 0.5, s);
			if (su > 0) {
				ctx.strokeStyle = ORANGE;
				ctx.lineWidth = 1.8;
				ctx.lineCap = 'round';
				ctx.beginPath();
				const sx = x + cw - 108;
				const sy = y + ch - 56;
				const n = Math.floor(su * 40);
				for (let i = 0; i <= n; i++) {
					const u = i / 40;
					const px = sx + u * 84;
					const py = sy + Math.sin(u * 14) * 7 * Math.sin(u * 3.14);
					i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
				}
				ctx.shadowColor = 'rgba(247,147,26,.8)';
				ctx.shadowBlur = 8;
				ctx.stroke();
				ctx.shadowBlur = 0;
				ctx.fillStyle = GRAY;
				ctx.font = mono(9);
				ctx.fillText('SIGNATURE', sx + 16, sy + 22);
			}
			if (s > 0.52) {
				ctx.fillStyle = GREEN;
				ctx.font = mono(10, 700);
				ctx.fillText('✓ SIGNED', x + cw - 92, y + 26);
			}
			ctx.globalAlpha = 1;
		}

		// ---- mempool cloud ----
		const aPool = io(s, 1.12, 1.42, 2.95, 3.3);
		if (aPool > 0.01) {
			ctx.textAlign = 'center';
			ctx.fillStyle = `rgba(139,143,156,${aPool})`;
			ctx.font = mono(11, 700);
			ctx.fillText('M E M P O O L', poolC.x, poolC.y - NR * 0.62);
			ctx.strokeStyle = `rgba(91,140,255,${0.22 * aPool})`;
			ctx.setLineDash([3, 6]);
			ctx.beginPath();
			ctx.arc(poolC.x, poolC.y, NR * 0.5, 0, 6.29);
			ctx.stroke();
			ctx.setLineDash([]);
			cloud.forEach((c, i) => {
				const sel = i < 3;
				const selU = sel ? sm(2.18 + i * 0.1, 2.5 + i * 0.1, s) : 0;
				const ang = c.ang + s * 1.6 + Math.sin(t + i) * 0.06;
				const ox = poolC.x + Math.cos(ang) * NR * 0.44 * c.rad;
				const oy = poolC.y + Math.sin(ang) * NR * 0.4 * c.rad;
				let x = ox;
				let y = oy;
				if (sel) {
					const slot = { x: blockHome.x - 40, y: blockHome.y - 52 + i * 30 };
					x = lerp(ox, slot.x, selU);
					y = lerp(oy, slot.y, selU);
				}
				const a = aPool * (sel ? 1 : s > 2.2 ? 0.45 : 0.9);
				ctx.fillStyle = `rgba(139,143,156,${a * 0.85})`;
				ctx.fillRect(x - c.sz / 2, y - c.sz / 2, c.sz, c.sz);
				if (sel && s > 2.1) {
					ctx.fillStyle = `rgba(157,123,255,${a})`;
					ctx.fillRect(x + c.sz / 2 + 4, y - 1.5, 14 * (0.4 + 0.6 * c.fee), 3);
				}
			});
			if (!MOB) {
				const lbl: [string, number][] = [
					['TX 9c1a…b6e2 · 0.002 BTC', 0],
					['TX d4e5…f6a7 · 0.001 BTC', 5],
				];
				ctx.font = mono(10);
				ctx.textAlign = 'left';
				for (const [txt, i] of lbl) {
					const c = cloud[i];
					const ang = c.ang + s * 1.6;
					const x = poolC.x + Math.cos(ang) * NR * 0.44 * c.rad;
					const y = poolC.y + Math.sin(ang) * NR * 0.4 * c.rad;
					ctx.fillStyle = `rgba(139,143,156,${aPool * io(s, 1.4, 1.6, 2.1, 2.3)})`;
					ctx.fillText(txt, x + 10, y + 3);
				}
			}
		}

		// ---- block ----
		let bw = MOB ? 150 : 180;
		let bh = MOB ? 180 : 210;
		let bx = blockHome.x;
		let by = blockHome.y;
		const aBlock = sm(2.02, 2.28, s) * (1 - sm(4.5, 4.72, s));
		const mv = sm(3.0, 3.35, s);
		bx = lerp(bx, center.x, mv);
		by = lerp(by, center.y, mv);
		const shr = sm(4.02, 4.2, s);
		if (shr > 0) {
			bw = lerp(bw, 48, shr);
			bh = lerp(bh, 48, shr);
			const path: Pt[] = [center, np(nodes[byX[4]], W, H), np(nodes[byX[9]], W, H), np(nodes[byX[12]], W, H), { x: W * 0.5, y: H * 0.5 }];
			const pu = sm(4.1, 4.55, s) * (path.length - 1);
			const i0 = clamp(Math.floor(pu), 0, path.length - 2);
			bx = lerp(path[i0].x, path[i0 + 1].x, pu - i0);
			by = lerp(path[i0].y, path[i0 + 1].y, pu - i0);
			ctx.strokeStyle = `rgba(247,147,26,${0.35 * io(s, 4.1, 4.2, 4.5, 4.65)})`;
			ctx.lineWidth = 1.5;
			for (let i = 0; i < Math.min(i0 + 1, path.length - 1); i++) {
				ctx.beginPath();
				ctx.moveTo(path[i].x, path[i].y);
				ctx.lineTo(path[i + 1].x, path[i + 1].y);
				ctx.stroke();
			}
		}
		const valid = s > 3.86;
		if (aBlock > 0.01 && s < 4.55) {
			ctx.globalAlpha = aBlock;
			ctx.fillStyle = 'rgba(20,22,27,.92)';
			ctx.strokeStyle = valid ? 'rgba(61,220,132,.7)' : 'rgba(247,147,26,.55)';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
			ctx.fill();
			ctx.stroke();
			if (shr < 0.5) {
				ctx.textAlign = 'center';
				ctx.font = mono(10, 700);
				ctx.fillStyle = valid ? GREEN : GRAY;
				ctx.fillText(valid ? 'VALID BLOCK' : 'CANDIDATE BLOCK', bx, by - bh / 2 - 14);
				if (s < 3.05) {
					ctx.fillStyle = VIOLET;
					ctx.font = mono(9);
					ctx.fillText('MINER', bx, by - bh / 2 - 30);
				}
				const rows = ['TX A', 'TX B', 'YOUR TX', 'TX D'];
				ctx.font = mono(10);
				ctx.textAlign = 'left';
				rows.forEach((r, i) => {
					const ru = sm(2.24 + i * 0.1, 2.56 + i * 0.1, s);
					if (ru <= 0) return;
					const ry = by - bh / 2 + 34 + i * 30;
					ctx.globalAlpha = aBlock * ru * (1 - shr * 2);
					ctx.fillStyle = r === 'YOUR TX' ? ORANGE : '#c9c8c2';
					ctx.fillText(r, bx - bw / 2 + 16, ry);
					ctx.strokeStyle = 'rgba(242,241,237,.1)';
					ctx.beginPath();
					ctx.moveTo(bx - bw / 2 + 12, ry + 9);
					ctx.lineTo(bx + bw / 2 - 12, ry + 9);
					ctx.stroke();
				});
				ctx.globalAlpha = aBlock;
				if (s > 3.05) {
					const fu = sm(3.7, 3.92, s);
					ctx.textAlign = 'center';
					ctx.font = mono(11);
					const target = '00000000000000000f…';
					const txt = fu >= 1 ? target : target.slice(0, Math.floor(fu * target.length)) + rhex(target.length - Math.floor(fu * target.length), t * 3, 3);
					ctx.fillStyle = valid ? GREEN : 'rgba(242,241,237,.75)';
					ctx.fillText(txt, bx, by + bh / 2 + 26);
					ctx.fillStyle = GRAY;
					ctx.font = mono(9);
					ctx.fillText('BLOCK HASH', bx, by + bh / 2 + 42);
				}
			}
			ctx.globalAlpha = 1;
		}

		// PoW compute rings + nonce column
		const aPow = io(s, 3.05, 3.25, 3.95, 4.15);
		if (aPow > 0.01) {
			for (let r = 0; r < 3; r++) {
				const ru = (t * 0.5 + r / 3) % 1;
				ctx.strokeStyle = `rgba(247,147,26,${(1 - ru) * 0.3 * aPow})`;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(bx, by, bh * 0.6 + ru * 90, 0, 6.29);
				ctx.stroke();
			}
			const nx = MOB ? W * 0.5 : bx - (MOB ? 0 : 290);
			const nyTop = MOB ? by - bh / 2 - 150 : by - 70;
			ctx.textAlign = 'left';
			ctx.font = mono(12);
			ctx.fillStyle = `rgba(139,143,156,${aPow})`;
			ctx.fillText('NONCE', nx, nyTop - 16);
			const found = s > 3.86;
			for (let i = 0; i < 5; i++) {
				const n = (Math.floor(t * (found ? 0 : 60)) * 7919 + i * 104729) % 9999999;
				const last = i === 4;
				ctx.fillStyle = last && found ? GREEN : `rgba(242,241,237,${aPow * (0.35 + i * 0.13)})`;
				ctx.font = mono(12, last && found ? 700 : 400);
				ctx.fillText(last && found ? '1739284  ✓' : String(n).padStart(7, '0') + '  ✕', nx, nyTop + i * 20);
			}
		}

		// valid flash
		const fl = io(s, 3.82, 3.88, 3.92, 4.05);
		if (fl > 0.01) {
			ctx.fillStyle = `rgba(247,147,26,${fl * 0.07})`;
			ctx.fillRect(0, 0, W, H);
		}

		// ---- chain (horizontal → vertical) ----
		const aCh = sm(4.5, 4.72, s);
		if (aCh > 0.01) {
			const vt = sm(5.0, 5.35, s);
			const cx = W * 0.5;
			const cy = H * 0.46;
			const bw2 = MOB ? 120 : 150;
			const bh2 = MOB ? 76 : 92;
			const gapH = MOB ? 140 : 180;
			const gapV = MOB ? 100 : 118;
			const items: ChainItem[] = [
				{ n: 839, i: -1 },
				{ n: 840, i: 0, mine: true },
				{ n: 841, i: 1 },
				{ n: 842, i: 2 },
				{ n: 843, i: 3 },
			];
			ctx.textAlign = 'center';
			items.forEach((it) => {
				const hx = cx + it.i * gapH;
				const hy = cy;
				const vx = cx;
				const vy = cy + (MOB ? 120 : 150) - (it.i + 1) * gapV;
				let ap = aCh;
				if (it.n === 839) ap *= 1 - sm(5.0, 5.2, s);
				if (it.n === 842) ap *= sm(5.35, 5.55, s);
				if (it.n === 843) ap *= sm(5.62, 5.82, s);
				if (ap <= 0.01) return;
				const x = it.n > 841 ? vx : lerp(hx, vx, vt);
				const y = it.n > 841 ? vy : lerp(hy, vy, vt);
				ctx.globalAlpha = ap;
				ctx.fillStyle = it.mine ? 'rgba(247,147,26,.1)' : 'rgba(20,22,27,.92)';
				ctx.strokeStyle = it.mine ? ORANGE : 'rgba(242,241,237,.2)';
				ctx.lineWidth = it.mine ? 1.6 : 1;
				ctx.beginPath();
				ctx.roundRect(x - bw2 / 2, y - bh2 / 2, bw2, bh2, 4);
				ctx.fill();
				ctx.stroke();
				ctx.fillStyle = it.mine ? ORANGE : '#c9c8c2';
				ctx.font = mono(12, 700);
				ctx.fillText('BLOCK ' + it.n, x, y - 8);
				if (it.mine) {
					ctx.fillStyle = ORANGE;
					ctx.font = mono(10, 700);
					ctx.fillText('YOUR TX ✓', x, y + 14);
				} else {
					ctx.fillStyle = 'rgba(139,143,156,.8)';
					ctx.font = mono(9);
					ctx.fillText(rhex(8, 0, it.n) + '…', x, y + 14);
				}
				if (it.i > -1 && it.n < 844) {
					const px2 = cx + (it.i - 1) * gapH;
					const py2 = cy;
					const vpx = cx;
					const vpy = cy + (MOB ? 120 : 150) - it.i * gapV;
					const lx = it.n > 841 ? vpx : lerp(px2, vpx, vt);
					const ly = it.n > 841 ? vpy : lerp(py2, vpy, vt);
					ctx.strokeStyle = `rgba(139,143,156,.4)`;
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(lx + (it.n > 841 || vt > 0.5 ? 0 : (bw2 / 2) * (1 - vt)), ly + (it.n > 841 || vt > 0.5 ? (bh2 / 2) * vt : 0));
					ctx.lineTo(x - (it.n > 841 || vt > 0.5 ? 0 : (bw2 / 2) * (1 - vt)), y - (it.n > 841 || vt > 0.5 ? (bh2 / 2) * vt : 0));
					ctx.stroke();
				}
				ctx.globalAlpha = 1;
			});
			if (s < 5.1) {
				const a2 = io(s, 4.72, 4.9, 5.0, 5.15);
				ctx.fillStyle = `rgba(61,220,132,${a2})`;
				ctx.font = mono(12, 700);
				ctx.fillText('✓ TRANSACTION INCLUDED', cx, cy + (MOB ? 90 : 110));
			} else {
				const conf = s > 5.62 ? 3 : s > 5.35 ? 2 : 1;
				const hx2 = MOB ? cx : cx + (MOB ? 0 : gapH * 1.35);
				const hy2 = MOB ? cy + 170 : cy;
				ctx.textAlign = MOB ? 'center' : 'left';
				ctx.fillStyle = '#f2f1ed';
				ctx.font = mono(26, 700);
				ctx.fillText(conf + (conf === 1 ? ' confirmation' : ' confirmations'), hx2, hy2);
				ctx.fillStyle = GRAY;
				ctx.font = mono(10);
				ctx.fillText('PROFUNDIDAD EN LA CADENA', hx2, hy2 + 20);
				if (s > 5.85) {
					ctx.fillStyle = GREEN;
					ctx.font = mono(13, 700);
					ctx.fillText('✓ TRANSACTION CONFIRMED', hx2, hy2 + 48);
				}
				ctx.textAlign = 'center';
			}
		}

		// ---- the user's transaction (always on top, always orange) ----
		let tp: Pt | null = null;
		let ta = sm(0.5, 0.62, s);
		const entry: Pt[] = [walletC, np(nodes[byX[2]], W, H), np(nodes[byX[6]], W, H), poolC];
		if (s < 0.62) {
			tp = { x: walletC.x + (MOB ? 0 : 60), y: walletC.y + 55 };
		} else if (s < 1.05) {
			const u = sm(0.62, 1.05, s);
			tp = { x: lerp(walletC.x + (MOB ? 0 : 60), entry[1].x, u), y: lerp(walletC.y + 55, entry[1].y, u) };
		} else if (s < 1.5) {
			const u = sm(1.05, 1.5, s) * 2;
			const i0 = clamp(Math.floor(u + 1), 1, 2);
			tp = {
				x: lerp(entry[i0].x, entry[i0 + 1].x, clamp(u - (i0 - 1), 0, 1)),
				y: lerp(entry[i0].y, entry[i0 + 1].y, clamp(u - (i0 - 1), 0, 1)),
			};
		} else if (s < 2.3) {
			const ang = s * 1.6 + 1.2 + Math.sin(t) * 0.08;
			tp = { x: poolC.x + Math.cos(ang) * NR * 0.2, y: poolC.y + Math.sin(ang) * NR * 0.18 };
		} else if (s < 2.66) {
			const u = sm(2.3, 2.66, s);
			const ang = 2.3 * 1.6 + 1.2;
			const from = { x: poolC.x + Math.cos(ang) * NR * 0.2, y: poolC.y + Math.sin(ang) * NR * 0.18 };
			const slot = { x: blockHome.x - bw / 2 + 20 + 50, y: blockHome.y - bh / 2 + 34 + 2 * 30 - 4 };
			tp = { x: lerp(from.x, slot.x, u), y: lerp(from.y, slot.y, u) };
		} else if (s < 4.55) {
			tp = { x: bx, y: by + (shr > 0 ? 0 : -bh / 2 + 34 + 2 * 30 - 4) };
			if (shr < 0.3 && s < 4.02) {
				tp.x = bx - bw / 2 + 70;
			}
		} else {
			const vt = sm(5.0, 5.35, s);
			const cx = W * 0.5;
			const cy = H * 0.46;
			tp = { x: cx, y: lerp(cy, cy + (MOB ? 120 : 150) - (MOB ? 100 : 118), vt) };
			ta = 1;
		}
		if (tp && ta > 0.01) {
			const pu = 0.75 + 0.25 * Math.sin(t * 3);
			const gl = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, 16);
			gl.addColorStop(0, `rgba(255,184,92,${0.9 * ta * pu})`);
			gl.addColorStop(1, 'rgba(247,147,26,0)');
			ctx.fillStyle = gl;
			ctx.beginPath();
			ctx.arc(tp.x, tp.y, 16, 0, 6.29);
			ctx.fill();
			ctx.fillStyle = ORANGE;
			ctx.beginPath();
			ctx.arc(tp.x, tp.y, 4.2, 0, 6.29);
			ctx.fill();
			ctx.fillStyle = '#ffe2bd';
			ctx.beginPath();
			ctx.arc(tp.x, tp.y, 1.6, 0, 6.29);
			ctx.fill();
			const la = io(s, 1.5, 1.7, 2.5, 2.7) * ta;
			if (la > 0.02 && !MOB) {
				ctx.textAlign = 'left';
				ctx.font = mono(10, 700);
				ctx.fillStyle = `rgba(247,147,26,${la})`;
				ctx.fillText(`TX 4b3f…a2d1 · ${monto.toFixed(3)} BTC ← TU TRANSACCIÓN`, tp.x + 14, tp.y + 3);
			}
		}

		raf = requestAnimationFrame(draw);
	};
	raf = requestAnimationFrame(draw);

	const goStage = (i: number) => {
		const range = sim.clientHeight - window.innerHeight;
		window.scrollTo({ top: sim.offsetTop + ((i + 0.45) / 6) * range, behavior: 'smooth' });
	};
	navBtns.forEach((b) => {
		const i = Number(b.dataset.goto);
		b.addEventListener('click', () => goStage(i));
	});
	document.getElementById('start-sim-btn')?.addEventListener('click', () => {
		primeAudio();
		tick(660, 0.1);
		window.scrollTo({ top: sim.offsetTop + window.innerHeight * 0.35, behavior: 'smooth' });
	});
	document.getElementById('restart-btn')?.addEventListener('click', () => {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	});

	// amount / fee pickers
	const heroMonto = document.getElementById('hero-monto');
	const heroFee = document.getElementById('hero-fee');
	document.querySelectorAll<HTMLButtonElement>('[data-monto]').forEach((btn) => {
		const v = Number(btn.dataset.monto);
		btn.addEventListener('click', () => {
			monto = v;
			document.querySelectorAll('[data-monto]').forEach((b) => b.classList.toggle('active', b === btn));
			if (heroMonto) heroMonto.textContent = monto.toFixed(3);
		});
	});
	document.querySelectorAll<HTMLButtonElement>('[data-fee]').forEach((btn) => {
		const v = Number(btn.dataset.fee);
		btn.addEventListener('click', () => {
			fee = v;
			document.querySelectorAll('[data-fee]').forEach((b) => b.classList.toggle('active', b === btn));
			if (heroFee) heroFee.textContent = fee + ' sat/vB';
		});
	});

	// sound toggle
	const soundBtn = document.getElementById('sound-toggle');
	if (soundBtn) {
		soundBtn.textContent = isSoundEnabled() ? '♪ ON' : '♪ OFF';
		soundBtn.addEventListener('click', () => {
			const next = !isSoundEnabled();
			setSoundEnabled(next);
			soundBtn.textContent = next ? '♪ ON' : '♪ OFF';
			if (next) {
				primeAudio();
				tick(880, 0.08);
			}
		});
	}

	window.addEventListener('beforeunload', () => {
		cancelAnimationFrame(raf);
		ro.disconnect();
	});
}
