/**
 * Preamp gain ranges per device.
 *
 * Classic OSC carries gain as kOSCScaleLin01 (0..1, no dB meaning) and contains
 * no device identifier, so dB-per-detent requires the preamp span from
 * elsewhere. Global OSC carries gain in dB and reports /status/device, so it
 * needs a ceiling rather than a span.
 *
 * The span affects dial travel only; displayed values come from TotalMix.
 */

/** Used when the device is unknown. The most common RME preamp span. */
export const FALLBACK_GAIN_DB = 65;

/**
 * One entry per device. `id` is what is stored in an action's settings.
 *
 * `gainDb` is the span of TotalMix's gain control, not the marketed figure: the
 * Babyface Pro FS is listed as 76 dB including an 11 dB PAD, while its gain
 * control runs 0..65.
 *
 * `sourced` marks figures confirmed against manufacturer documentation. The rest
 * are inferred from a device sharing the same preamp generation.
 */
export interface RmeDevice {
	id: string;
	label: string;
	gainDb: number;
	sourced: boolean;
	/** Lowercased fragments that identify this device in a /status/device string. */
	match: readonly string[];
}

export const DEVICES: readonly RmeDevice[] = [
	// --- 75 dB generation (UFX II preamp design, PAD-free, +18 dBu) ---
	{
		id: "ufx2",
		label: "Fireface UFX II",
		gainDb: 75,
		sourced: true, // rme-audio.de: "75 dB gain range"
		match: ["ufx ii", "ufxii", "ufx2"],
	},
	{
		id: "ufxplus",
		label: "Fireface UFX+",
		gainDb: 75,
		sourced: true,
		match: ["ufx+", "ufx plus"],
	},
	{
		id: "ufx3",
		label: "Fireface UFX III",
		gainDb: 75,
		sourced: false, // same preamp family as UFX+/UFX II
		match: ["ufx iii", "ufxiii", "ufx3"],
	},
	{
		id: "ucx2",
		label: "Fireface UCX II",
		gainDb: 75,
		sourced: true, // rme-audio.de and the UCX II manual
		match: ["ucx ii", "ucxii", "ucx2"],
	},
	{
		id: "12mic",
		label: "12Mic / 12Mic-D",
		gainDb: 75,
		sourced: true,
		match: ["12mic"],
	},
	{
		id: "m1610",
		label: "M-1610 Pro",
		gainDb: 75,
		sourced: false,
		match: ["m-1610", "m1610"],
	},
	{
		id: "ff802",
		label: "Fireface 802 / 802 FS",
		gainDb: 75,
		sourced: false,
		match: ["802"],
	},

	// --- 65 dB generation ---
	{
		id: "ucx",
		label: "Fireface UCX",
		gainDb: 65,
		sourced: true, // rme-audio.de: "Mic/Line preamps (65 dB Gain)"
		match: ["ucx"],
	},
	{
		id: "uc",
		label: "Fireface UC",
		gainDb: 65,
		sourced: false,
		match: ["fireface uc", "ff uc"],
	},
	{
		id: "ufx",
		label: "Fireface UFX",
		gainDb: 65,
		sourced: false,
		match: ["ufx"],
	},
	{
		id: "bfpro",
		label: "Babyface Pro / Pro FS",
		gainDb: 65,
		sourced: true, // Babyface Pro FS manual: "0 dB to +65 dB", 1 dB steps
		match: ["babyface pro", "bfpro", "bf pro"],
	},
	{
		id: "ff400",
		label: "Fireface 400 / 800",
		gainDb: 65,
		sourced: false,
		match: ["fireface 400", "fireface 800"],
	},

	// --- 60 dB ---
	{
		id: "babyface",
		label: "Babyface (original)",
		gainDb: 60,
		sourced: false,
		match: ["babyface"],
	},
] as const;

/** Escapes regex metacharacters that appear in model names ("UFX+", "M-1610"). */
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/**
 * Fragment matchers, ordered longest first and anchored to word boundaries.
 *
 * Length ordering prevents "ucx" matching "Fireface UCX II". Boundary anchoring
 * prevents "fireface uc" — the longer fragment — matching it either, while still
 * allowing "ufx+" and "12mic-d".
 */
const MATCHERS: ReadonlyArray<{ pattern: RegExp; device: RmeDevice }> = DEVICES.flatMap((device) =>
	device.match.map((fragment) => ({ fragment, device })),
)
	.sort((a, b) => b.fragment.length - a.fragment.length)
	.map(({ fragment, device }) => ({
		pattern: new RegExp(`(?<![a-z0-9])${escape(fragment)}(?![a-z0-9])`),
		device,
	}));

/** Resolves a /status/device string to a known device by fragment match. */
export function matchDevice(name: string): RmeDevice | undefined {
	const haystack = name.toLowerCase();
	return MATCHERS.find((m) => m.pattern.test(haystack))?.device;
}

/** Looks up a device by the id stored in an action's settings. */
export const deviceById = (id: string): RmeDevice | undefined => DEVICES.find((d) => d.id === id);

/**
 * Last device reported by /status/device on any Global OSC connection.
 * Undefined when no Global OSC connection has reported one.
 */
let detected: RmeDevice | undefined;
let lastUnknown: string | undefined;

/** Records a name from /status/device. Unrecognised names are logged once each. */
export function rememberDevice(name: string, warn?: (msg: string) => void): void {
	const trimmed = name.trim();
	if (trimmed === "") return;

	const device = matchDevice(trimmed);
	if (device !== undefined) {
		detected = device;
		return;
	}

	// Logged once per distinct name so the table can be extended from reports.
	if (lastUnknown !== trimmed) {
		lastUnknown = trimmed;
		warn?.(`Unknown RME device "${trimmed}"; using ${FALLBACK_GAIN_DB} dB for gain steps.`);
	}
}

/** The auto-detected device, if Global OSC has reported one. */
export const detectedDevice = (): RmeDevice | undefined => detected;

/** Clears detection state. Used by tests. */
export function resetDeviceDetection(): void {
	detected = undefined;
	lastUnknown = undefined;
}

/**
 * Gain span for a classic gain dial: the configured device, or the fallback.
 *
 * Detection is not consulted. The device name exists only on the Global OSC
 * slot, so using it here would make dial travel depend on whether an unrelated
 * controller slot is connected.
 */
export function gainRangeDb(settingId?: string): number {
	if (settingId !== undefined && settingId !== "") {
		const picked = deviceById(settingId);
		if (picked !== undefined) return picked.gainDb;
	}
	return FALLBACK_GAIN_DB;
}

/**
 * Gain ceiling in dB for Global OSC, taken from the reported device.
 *
 * Global OSC carries gain in dB, so it needs a ceiling rather than a span, and
 * that ceiling is device-specific. /status/device arrives on the same
 * connection.
 */
export function detectedMaxGainDb(fallback: number): number {
	return detectedDevice()?.gainDb ?? fallback;
}
