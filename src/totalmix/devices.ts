/**
 * Preamp gain spans per device.
 *
 * Classic OSC: gain is kOSCScaleLin01 with no device identifier, so the dB
 * per detent needs the span from the configured device. Global OSC: gain is
 * treated as dB (unit unspecified in the table) and /status/device gives the
 * ceiling. Displayed values always come from TotalMix.
 */

/** Used when the device is unknown. The most common RME preamp span. */
export const FALLBACK_GAIN_DB = 65;

/**
 * `id` is stored in action settings. `gainDb` is the span of TotalMix's gain
 * control (Babyface Pro FS: 0..65, not the marketed 76 dB incl. PAD).
 * `sourced`: confirmed in RME documentation; otherwise inferred from the
 * preamp generation.
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

/** Fragment matchers, longest first, anchored to alphanumeric boundaries ("ucx" must not match "UCX II"). */
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

/** Last device reported by /status/device on any Global OSC connection. */
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

	// Logged once per distinct name.
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

/** Classic gain span: configured device or fallback. Global OSC detection is not consulted. */
export function gainRangeDb(settingId?: string): number {
	if (settingId !== undefined && settingId !== "") {
		const picked = deviceById(settingId);
		if (picked !== undefined) return picked.gainDb;
	}
	return FALLBACK_GAIN_DB;
}

/** Global OSC gain ceiling in dB from the detected device, or `fallback`. */
export function detectedMaxGainDb(fallback: number): number {
	return detectedDevice()?.gainDb ?? fallback;
}
