/**
 * Address builders for RME Global OSC (TotalMix FX 2.1 beta 2, table dated
 * 2026-07-21).
 *
 * Addressing is absolute. Channel numbers count from 0; snapshot, layout and
 * group numbers from 1. Stereo pairs are addressed by the left number, except
 * for the L/R-split parameters (phase, gain, delay, Room EQ bands) where the
 * right channel is left + 1. The table leaves value units unspecified except
 * for mix "fader" ([dB]) and "faderlin" (0..1 fader curve).
 */

export type GlobalBus = "input" | "playback" | "output";

/** Mix node source buses: hardware input or software playback. */
export type MixSourceBus = "in" | "pb";

// --- Channel parameters: /{bus}/{channel}/{param} -----------------------------

export const channel = (bus: GlobalBus, ch: number, param: string): string =>
	`/${bus}/${ch}/${param}`;

export const channelFaderlin = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "faderlin");

export const channelMute = (bus: GlobalBus, ch: number): string => channel(bus, ch, "mute");

export const channelName = (bus: GlobalBus, ch: number): string => channel(bus, ch, "name");

/** Preamp gain, input bus, L/R-split. Treated as dB; the table gives no unit. */
export const channelGain = (ch: number): string => channel("input", ch, "gain");

export const channelStereo = (bus: GlobalBus, ch: number): string => channel(bus, ch, "stereo");

export const channelEqEnable = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "eq/enable");
export const channelLowcutEnable = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "lowcut/enable");
export const channelDynamicsEnable = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "dynamics/enable");
export const channelAutolevelEnable = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "autolevel/enable");
export const channelRoomEqEnable = (bus: GlobalBus, ch: number): string =>
	channel(bus, ch, "roomeq/enable");

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
/** 0-based output channel assigned as Main Out (0.0 = channel 1+2). No separate master volume exists. */
export const CR_MAINOUT = controlroom("mainout");
export const CR_MAIN_MONO = controlroom("mainmono");
export const CR_TALKBACK = controlroom("talkback");
export const CR_EXTERNAL_IN = controlroom("externalin");
export const CR_SPEAKER_B = controlroom("speakerb");
export const CR_MUTE_FX = controlroom("mutefx");
export const CR_LINK_AB = controlroom("linkab");
/** (f) trigger, receive only. */
export const CR_RECALL = controlroom("recall");

// --- FX: /reverb/{param}, /echo/{param} ---------------------------------------

export const reverb = (param: string): string => `/reverb/${param}`;
export const echo = (param: string): string => `/echo/${param}`;

export const REVERB_ENABLE = reverb("enable");
export const ECHO_ENABLE = echo("enable");

// --- Top-level ----------------------------------------------------------------

export const GLOBAL_MUTE = "/globalmute";
export const GLOBAL_SOLO = "/globalsolo";
/** (f) triggers. */
export const UNDO = "/undo";
export const REDO = "/redo";

/** f: 1 shows, 0 hides the TotalMix window. */
export const SHOW_WINDOW = "/showwindow";

// --- Groups, snapshots, layouts (numbered from 1) -----------------------------

const groupNumber = (n: number): number => Math.min(4, Math.max(1, Math.round(n)));

/** Receive only; TotalMix does not report group state. */
export const muteGroup = (n: number): string => `/mutegroup/${groupNumber(n)}`;
export const soloGroup = (n: number): string => `/sologroup/${groupNumber(n)}`;
export const faderGroup = (n: number): string => `/fadergroup/${groupNumber(n)}`;

/** Receive: only 1 accepted. Send: 0 = off, 2 = active, 3 = changed. */
export const snapshotLoad = (n: number): string => `/snapshot/load/${n}`;

/** (f), receive only. */
export const layoutLoad = (n: number): string => `/layout/load/${n}`;

// --- DURec: /durec/{command} --------------------------------------------------

export const durec = (command: string): string => `/durec/${command}`;

export const DUREC_PLAY = durec("play");
export const DUREC_PAUSE = durec("pause");
/** Ignored below 0.5; stopping a recording needs two sends or a value > 10. */
export const DUREC_STOP = durec("stop");
export const DUREC_RECORD = durec("record");
export const DUREC_NEXT = durec("next");
export const DUREC_PREVIOUS = durec("previous");
/** Send-only string: "Not ready", "Stop", "Record", "Play", "Pause". */
export const DUREC_STATE = durec("state");
/** Send-only string. */
export const DUREC_TIME = durec("time");

// --- Refresh triggers ---------------------------------------------------------

/** (f): re-sends all parameters; 2 limits mix nodes to fader > -65 dB. */
export const SEND_ALL = "/sendall";
/** (f): control parameters and FX settings. */
export const SEND_SETTINGS = "/sendsettings";
/** (f): all status messages incl. DURec. */
export const SEND_STATE = "/sendstate";

/** (f): all parameters of one channel. */
export const sendChan = (bus: GlobalBus, ch: number): string => `/sendchan/${bus}/${ch}`;

/** f: 1 all nodes of the submix, 2 only nodes with fader > -65 dB. */
export const sendSubmix = (out: number): string => `/sendsubmix/${out}`;

// --- Level meters (send only) -------------------------------------------------

/** The level tree uses short bus names. */
export type LevelBus = "in" | "pb" | "out";

/** Peak level [dB]; only changes are sent. */
export const level = (bus: LevelBus, ch: number): string => `/level/${bus}/${ch}`;

export const levelBusOf = (bus: GlobalBus): LevelBus =>
	bus === "input" ? "in" : bus === "playback" ? "pb" : "out";

// --- Status (send only, ~1 message per second) ----------------------------------

export const STATUS_DEVICE = "/status/device";
export const STATUS_CONNECTION = "/status/connection";
export const STATUS_DSP = "/status/dsp";
