/**
 * Address construction for RME's Global OSC protocol (TotalMix FX 2.1 beta 2,
 * table dated 2026-07-21).
 *
 * Addressing is absolute: /output/2/faderlin always means output channel 2
 * (0-based; channel 3 in the GUI, 3+4 if stereo), independent of any bank, bus
 * or page a controller slot shows. There is no view to pin.
 *
 * Numbering rules from the table's Description sheet:
 * - channel numbers count from 0;
 * - snapshot / layout / group numbers count from 1;
 * - stereo channels are addressed by the LEFT channel number, except for the
 *   L/R-flagged parameters (phase, gain, delay, Room EQ bands) where the right
 *   channel is left + 1.
 */

export type GlobalBus = "input" | "playback" | "output";

/** The /mix node tree only distinguishes hardware-in from software-playback. */
export type MixSourceBus = "in" | "pb";

// --- Per-channel parameters: /{bus}/{channel}/{param} -------------------------

/** Any single-level channel parameter, e.g. channel(\"output\", 2, \"faderlin\"). */
export const channel = (bus: GlobalBus, ch: number, param: string): string =>
	`/${bus}/${ch}/${param}`;

export const channelFaderlin = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "faderlin");

export const channelMute = (bus: GlobalBus, ch: number): string => channel(bus, ch, "mute");

export const channelName = (bus: GlobalBus, ch: number): string => channel(bus, ch, "name");

/**
 * Preamp gain in dB; the table leaves the unit unspecified. L/R-split: on a
 * stereo pair the right side is addressed at channel + 1.
 */
export const channelGain = (ch: number): string => channel("input", ch, "gain");

export const channelStereo = (bus: GlobalBus, ch: number): string => channel(bus, ch, "stereo");

// --- Mix nodes: /mix/{in|pb}/{input}/{output}/{param} -------------------------

export const mixNode = (
	src: MixSourceBus,
	input: number,
	output: number,
	param: string,
): string => `/mix/${src}/${input}/${output}/${param}`;

export const mixFaderlin = (src: MixSourceBus, input: number, output: number): string =>
	mixNode(src, input, output, "faderlin");

export const mixSolo = (src: MixSourceBus, input: number, output: number): string =>
	mixNode(src, input, output, "solo");

// --- Control room: /controlroom/{param} ---------------------------------------

export const controlroom = (param: string): string => `/controlroom/${param}`;

export const CR_DIM = controlroom("dim");
/**
 * Output channel the Control Room's Main Out is assigned to, in 0-based channel
 * numbering (value 0.0 = channel 1+2). Main out volume is that output channel's
 * fader; Global OSC has no separate mastervolume address.
 */
export const CR_MAINOUT = controlroom("mainout");
export const CR_MAIN_MONO = controlroom("mainmono");
export const CR_TALKBACK = controlroom("talkback");
export const CR_EXTERNAL_IN = controlroom("externalin");
export const CR_SPEAKER_B = controlroom("speakerb");
export const CR_MUTE_FX = controlroom("mutefx");
export const CR_LINK_AB = controlroom("linkab");
export const CR_RECALL = controlroom("recall");

// --- FX: /reverb/{param}, /echo/{param} ---------------------------------------

export const reverb = (param: string): string => `/reverb/${param}`;
export const echo = (param: string): string => `/echo/${param}`;

export const REVERB_ENABLE = reverb("enable");
export const ECHO_ENABLE = echo("enable");

// --- Top-level ----------------------------------------------------------------

export const GLOBAL_MUTE = "/globalmute";
export const GLOBAL_SOLO = "/globalsolo";
export const UNDO = "/undo";
export const REDO = "/redo";

/** f-typed, not (f): 1 shows the TotalMix window, 0 hides it. */
export const SHOW_WINDOW = "/showwindow";

// --- Groups, snapshots, layouts (all numbered from 1) -------------------------

/** Receive-only in this protocol: TotalMix never reports group state back. */
export const muteGroup = (n: number): string => `/mutegroup/${n}`;
export const soloGroup = (n: number): string => `/sologroup/${n}`;
export const faderGroup = (n: number): string => `/fadergroup/${n}`;

/**
 * Send 1.0 to load. TotalMix reports state on the same address:
 * 0 = off, 2 = active, 3 = changed.
 */
export const snapshotLoad = (n: number): string => `/snapshot/load/${n}`;

export const layoutLoad = (n: number): string => `/layout/load/${n}`;

// --- DURec: /durec/{command} --------------------------------------------------

export const durec = (command: string): string => `/durec/${command}`;

export const DUREC_PLAY = durec("play");
export const DUREC_PAUSE = durec("pause");
/** Per the table: during recording, stop must be sent twice — or with a value > 10. */
export const DUREC_STOP = durec("stop");
export const DUREC_RECORD = durec("record");
export const DUREC_NEXT = durec("next");
export const DUREC_PREVIOUS = durec("previous");
/** Send-only strings: "Not ready", "Stop", "Record", "Play", "Pause". */
export const DUREC_STATE = durec("state");
export const DUREC_TIME = durec("time");

// --- Refresh triggers ---------------------------------------------------------

/** (f): triggers a send of ALL parameters; value 2 limits mix nodes to fader > -65 dB. */
export const SEND_ALL = "/sendall";
export const SEND_SETTINGS = "/sendsettings";
export const SEND_STATE = "/sendstate";

export const sendChan = (bus: GlobalBus, ch: number): string => `/sendchan/${bus}/${ch}`;

/** f-typed: 1 triggers all of one submix's nodes, 2 only those with fader > -65 dB. */
export const sendSubmix = (out: number): string => `/sendsubmix/${out}`;

// --- Level meters (send-only) -------------------------------------------------

/** The level tree uses SHORT bus names, unlike the channel tree: in | pb | out. */
export type LevelBus = "in" | "pb" | "out";

/** Peak level [dB]; TotalMix sends only changing values. */
export const level = (bus: LevelBus, ch: number): string => `/level/${bus}/${ch}`;

export const levelBusOf = (bus: GlobalBus): LevelBus =>
	bus === "input" ? "in" : bus === "playback" ? "pb" : "out";

// --- Status (send-only) -------------------------------------------------------

export const STATUS_DEVICE = "/status/device";
export const STATUS_CONNECTION = "/status/connection";
export const STATUS_DSP = "/status/dsp";
