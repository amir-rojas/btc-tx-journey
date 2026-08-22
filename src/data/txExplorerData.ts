/**
 * Mock UTXO graph for the "RASTREAR TX" block-explorer tab.
 *
 * Ported verbatim from the Claude Design source's `this._txs` object.
 * Shared between the Astro page (initial server-rendered panel) and
 * `txExplorer.ts` (search / follow-the-money re-renders) so both stay
 * in sync with a single source of truth.
 */

export type TxInput = { addr: string; val: string };
export type TxOutput = { addr: string; val: string; tag: string; next: string | null };
export type TxRecord = {
	id: string;
	block: string;
	conf: string;
	fee: string;
	inputs: TxInput[];
	outputs: TxOutput[];
	nota: string;
};

export const TXS: Record<string, TxRecord> = {
	'4b3f…a2d1': {
		id: '4b3f…a2d1',
		block: '840,000',
		conf: '6+',
		fee: '0.00020 BTC · 12 sat/vB',
		inputs: [{ addr: '1A1zP1…5QGefi2 (Alice)', val: '0.01950 BTC' }],
		outputs: [
			{ addr: 'bc1qxy…w0en3 (Bob)', val: '0.00500 BTC', tag: 'GASTADO EN 9e12…77af', next: '9e12…77af' },
			{ addr: '1A1zP1…5QGefi2', val: '0.01430 BTC', tag: 'CAMBIO · SIN GASTAR', next: null },
		],
		nota: 'El segundo output vuelve al emisor: es el "cambio". Detectar el cambio te dice quién controla la transacción.',
	},
	'9e12…77af': {
		id: '9e12…77af',
		block: '840,112',
		conf: '6+',
		fee: '0.00034 BTC · 18 sat/vB',
		inputs: [
			{ addr: 'bc1qxy…w0en3 (Bob)', val: '0.00500 BTC' },
			{ addr: 'bc1q8k…r4m2 (Bob)', val: '0.01200 BTC' },
		],
		outputs: [
			{ addr: '3FZbgi…kdT9 (Exchange)', val: '0.01620 BTC', tag: 'GASTADO EN c0de…12ef', next: 'c0de…12ef' },
			{ addr: 'bc1q7d…p9x1', val: '0.00046 BTC', tag: 'CAMBIO · SIN GASTAR', next: null },
		],
		nota: 'Bob combinó dos UTXOs propios en un solo pago: eso vincula ambas direcciones a la misma entidad (heurística de co-gasto).',
	},
	'c0de…12ef': {
		id: 'c0de…12ef',
		block: '840,510',
		conf: '6+',
		fee: '0.00089 BTC · 22 sat/vB',
		inputs: [
			{ addr: '3FZbgi…kdT9 (Exchange)', val: '0.01620 BTC' },
			{ addr: '3FZbgi…kdT9 (+214 inputs)', val: '1.18920 BTC' },
		],
		outputs: [{ addr: 'bc1qcold…v8s3 (Cold wallet)', val: '1.20451 BTC', tag: 'SIN GASTAR · FIN DEL RASTRO', next: null }],
		nota: 'Consolidación típica de exchange: cientos de depósitos barridos a una cold wallet. Aquí el rastro on-chain termina — el siguiente paso es pedir registros KYC al exchange.',
	},
};

export const DEFAULT_TX_ID = '4b3f…a2d1';

export type Heuristica = { name: string; conf: string; desc: string; ej: string };

export const HEURISTICAS: Heuristica[] = [
	{
		name: 'CO-SPEND',
		conf: 'CONFIANZA ALTA',
		desc: 'Si varios inputs se gastan juntos en una TX, todas esas direcciones pertenecen a la misma entidad: firmar requiere sus claves privadas.',
		ej: 'la TX 9e12…77af combina dos direcciones de Bob.',
	},
	{
		name: 'CHANGE DETECTION',
		conf: 'CONFIANZA MEDIA',
		desc: 'El output que vuelve al emisor (dirección nueva, monto "no redondo", mismo tipo de script) es el cambio. Identificarlo mantiene el hilo de quién paga.',
		ej: 'en 4b3f…a2d1, 0.01430 BTC vuelve a Alice.',
	},
	{
		name: 'REUTILIZACIÓN',
		conf: 'CONFIANZA ALTA',
		desc: 'Una dirección usada muchas veces acumula historial vinculable. Los exchanges reutilizan direcciones de depósito y consolidación — por eso sus clusters son públicos.',
		ej: '3FZbgi…kdT9 recibe cientos de depósitos.',
	},
	{
		name: 'PEEL CHAIN',
		conf: 'PATRÓN',
		desc: 'Cadena de TXs donde cada una "pela" un monto pequeño hacia fuera y pasa el resto a una dirección nueva. Típica de lavado y de pagos de ransomware.',
		ej: 'buscarías montos que se reducen salto a salto.',
	},
];

export type MisionOption = { label: string; ok: boolean; feedback: string };
export type MisionStep = { texto: string; opciones: MisionOption[] };

export const MISION_PASOS: MisionStep[] = [
	{
		texto: 'El atacante movió los 0.8 BTC robados. Primera TX: 2 outputs — 0.05 BTC a una dirección nueva bc1q… y 0.749 BTC a otra dirección nueva bc1q…. ¿Cuál sigues?',
		opciones: [
			{
				label: 'EL DE 0.05 BTC',
				ok: false,
				feedback:
					'✕ Ese es el "peel": un pago pequeño hacia fuera. El grueso del botín sigue en el output grande — estás ante una peel chain.',
			},
			{
				label: 'EL DE 0.749 BTC',
				ok: true,
				feedback: '✓ Correcto. En una peel chain el monto grande es el botín en tránsito; el pequeño es un pago o cash-out parcial.',
			},
		],
	},
	{
		texto: 'Tres saltos después, el monto grande llega a una dirección 3… que ha recibido 4,000+ TXs de cientos de direcciones distintas. ¿Qué es?',
		opciones: [
			{
				label: 'OTRA WALLET DEL ATACANTE',
				ok: false,
				feedback:
					'✕ Improbable: una wallet personal no recibe miles de TXs de fuentes no relacionadas. Ese patrón de reutilización masiva es un servicio.',
			},
			{
				label: 'DEPÓSITO DE UN EXCHANGE',
				ok: true,
				feedback:
					'✓ Exacto. Reutilización + volumen + prefijo 3… (P2SH multisig) = dirección de depósito de un exchange con cluster etiquetado.',
			},
		],
	},
	{
		texto: 'Los fondos están en el exchange. ¿Cuál es tu siguiente movimiento como analista?',
		opciones: [
			{
				label: 'SEGUIR MIRANDO LA CADENA',
				ok: false,
				feedback:
					'✕ On-chain ya no verás al atacante: dentro del exchange los fondos se mezclan en wallets ómnibus. El rastro público terminó.',
			},
			{
				label: 'SOLICITUD LEGAL AL EXCHANGE (KYC)',
				ok: true,
				feedback:
					'✓ Caso cerrado. El exchange tiene la identidad verificada del dueño de esa cuenta. Ahí interviene la ley — exactamente para eso rastreaste hasta un punto con KYC.',
			},
		],
	},
];
