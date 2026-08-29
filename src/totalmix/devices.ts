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
	/**
	 * Reference level lists as TotalMix shows them, in list order (rising
	 * 0 dBFS level). Omitted bus: the device has no switchable reference
	 * level there. Some channels offer fewer entries than the bus list
	 * (UFX III: +24 dBu only on the XLR outputs); TotalMix ignores an entry a
	 * channel lacks.
	 */
	refLevels?: { input?: readonly string[]; output?: readonly string[] };
}

/** Naming used by TotalMix for UCX II, UFX III and the M-series: 0 dBFS level. */
const NEW_IN = ["+13 dBu", "+19 dBu"] as const;
const NEW_OUT = ["+4 dBu", "+13 dBu", "+19 dBu"] as const;
const NEW_OUT_24 = ["+4 dBu", "+13 dBu", "+19 dBu", "+24 dBu"] as const;
const NEW_IN_24 = ["+4 dBu", "+13 dBu", "+19 dBu", "+24 dBu"] as const;

/** Legacy naming (UFX, UFX+, UFX II, 802, UC, UCX): reference level, same order. */
const LEGACY_IN = ["-10 dBV", "+4 dBu", "Lo Gain"] as const;
const LEGACY_OUT = ["-10 dBV", "+4 dBu", "Hi Gain"] as const;

export const DEVICES: readonly RmeDevice[] = [
	// --- 75 dB generation (UFX II preamp design, PAD-free, +18 dBu) ---
	{
		id: "ufx2",
		label: "Fireface UFX II",
		gainDb: 75,
		sourced: true, // rme-audio.de: "75 dB gain range"
		match: ["ufx ii", "ufxii", "ufx2"],
		refLevels: { input: LEGACY_IN, output: LEGACY_OUT },
	},
	{
		id: "ufxplus",
		label: "Fireface UFX+",
		gainDb: 75,
		sourced: true,
		match: ["ufx+", "ufx plus"],
		refLevels: { input: LEGACY_IN, output: LEGACY_OUT },
	},
	{
		id: "ufx3",
		label: "Fireface UFX III",
		gainDb: 75,
		sourced: false, // same preamp family as UFX+/UFX II
		match: ["ufx iii", "ufxiii", "ufx3"],
		refLevels: { input: NEW_IN, output: NEW_OUT_24 } // UFX III manual ch. 19.1 / 20.1,
	},
	{
		id: "ucx2",
		label: "Fireface UCX II",
		gainDb: 75,
		sourced: true, // rme-audio.de and the UCX II manual
		match: ["ucx ii", "ucxii", "ucx2"],
		refLevels: { input: NEW_IN, output: NEW_OUT } // UCX II manual ch. 39.1,
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
		refLevels: { input: NEW_IN_24, output: NEW_OUT_24 } // +24 dBu per RME level guide; order inferred,
	},
	{
		id: "ff802",
		label: "Fireface 802 / 802 FS",
		gainDb: 75,
		sourced: false,
		match: ["802"],
		refLevels: { input: LEGACY_IN, output: LEGACY_OUT },
	},

	// --- 65 dB generation ---
	{
		id: "ucx",
		label: "Fireface UCX",
		gainDb: 65,
		sourced: true, // rme-audio.de: "Mic/Line preamps (65 dB Gain)"
		match: ["ucx"],
		refLevels: { input: LEGACY_IN, output: LEGACY_OUT },
	},
	{
		id: "uc",
		label: "Fireface UC",
		gainDb: 65,
		sourced: false,
		match: ["fireface uc", "ff uc"],
		refLevels: { input: LEGACY_IN, output: LEGACY_OUT } // rme-audio.de: -10 dBV, +4 dBu, Lo/Hi Gain,
	},
	{
		id: "ufx",
		label: "Fireface UFX",
		gainDb: 65,
		sourced: false,
		match: ["ufx"],
		refLevels: { input: LEGACY_IN, output: LEGACY_OUT } // UFX manual p. 41,
	},
	{
		id: "bfpro",
		label: "Babyface Pro / Pro FS",
		gainDb: 65,
		sourced: true, // Babyface Pro FS manual: "0 dB to +65 dB", 1 dB steps
		match: ["babyface pro", "bfpro", "bf pro"],
		refLevels: { input: ["-10 dBV", "+4 dBu"] } // TRS inputs 3/4 only; outputs use the hardware switch,
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

/** Resolves a /status/device string to a known device by fragment match. A trailing unit index, "Fireface UCX II (1)", is ignored. */
export function matchDevice(name: string): RmeDevice | undefined {
	const haystack = name.toLowerCase().replace(/\s*\(\d+\)\s*$/, "");
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

/**
 * Reference level list of the detected device for a bus, or undefined when
 * no device is known or the device has no switchable level on that bus.
 */
export function detectedRefLevels(bus: "input" | "output"): readonly string[] | undefined {
	return detectedDevice()?.refLevels?.[bus];
}

/** Global OSC gain ceiling in dB from the detected device, or `fallback`. */
export function detectedMaxGainDb(fallback: number): number {
	return detectedDevice()?.gainDb ?? fallback;
}
