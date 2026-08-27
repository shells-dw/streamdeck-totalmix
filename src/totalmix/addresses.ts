/**
 * Address construction for TotalMix FX, following RME's OSC table (1.96).
 *
 * The addressing is control-element oriented, not channel oriented: "/1/volume3"
 * means "the third fader of whatever bank is currently shown", not "channel 3".
 * Bank position is moved with /setBankStart, and the bus (input/playback/output)
 * with the bus* addresses. Everything here is a thin, typed wrapper over that.
 */

export type Bus = "input" | "playback" | "output";

/** Faders per bank on page 1. RME's default is 8; configurable in TotalMix. */
export const DEFAULT_BANK_SIZE = 8;

// --- Page-independent, receive-only direct selectors -------------------------
// These are the reason submix and channel selection does not need Mackie-style
// record-enable navigation.

/** Selects a submix directly by index (0 .. submixCount-1). */
export const SET_SUBMIX = "/setSubmix";

/** Selects a channel directly (0 .. channelCount-1); becomes the bank start on page 1. */
export const SET_BANK_START = "/setBankStart";

/** Sets the page-2 channel relative to the bank start, counted in faders. */
export const SET_OFFSET_IN_BANK = "/setOffsetInBank";

/** Loads a configured Quick Workspace (1..30). */
export const LOAD_QUICK_WORKSPACE = "/loadQuickWorkspace";

// --- Page 1: mixer -----------------------------------------------------------

export const bus = (b: Bus): string =>
	b === "input" ? "/1/busInput" : b === "playback" ? "/1/busPlayback" : "/1/busOutput";

/** Fader for the nth strip in the current bank (1-based, as RME numbers them). */
export const volume = (strip: number): string => `/1/volume${strip}`;

export const pan = (strip: number): string => `/1/pan${strip}`;

/** Per-strip mute. RME's grid addressing: /1/mute/1/<strip>. */
export const mute = (strip: number): string => `/1/mute/1/${strip}`;

export const solo = (strip: number): string => `/1/solo/1/${strip}`;

export const phantom = (strip: number): string => `/1/phantom/1/${strip}`;

export const cue = (strip: number): string => `/1/cue/1/${strip}`;

export const trackName = (strip: number): string => `/1/trackname${strip}`;

/**
 * Preamp/digital input gain for a strip. Input bus only; the scale is device- and
 * channel-dependent (kOSCScaleLin01 over whatever range the preamp has), so the
 * ...Val string from TotalMix is the only trustworthy display. On stereo channels
 * TotalMix applies it to both sides.
 */
export const micGain = (strip: number): string => `/1/micgain${strip}`;

export const LABEL_SUBMIX = "/1/labelSubmix";

// Main / control room.
// NB: RME's name really is "mastervolume" — /1/mainVolume does not exist and
// TotalMix silently ignores unknown addresses. Verified against the 1.96 table.
export const MAIN_VOLUME = "/1/mastervolume";
export const MAIN_DIM = "/1/mainDim";
export const MAIN_MONO = "/1/mainMono";
export const MAIN_RECALL = "/1/mainRecall";
export const MAIN_MUTE_FX = "/1/mainMuteFx";
export const MAIN_EXT_IN = "/1/mainExtIn";
export const MAIN_TALKBACK = "/1/mainTalkback";
export const MAIN_SPEAKER_B = "/1/mainSpeakerB";
export const SPEAKER_B_LINKED = "/1/speakerBLinked";
export const GLOBAL_MUTE = "/1/globalMute";
export const GLOBAL_SOLO = "/1/globalSolo";
export const TRIM = "/1/trim";

// Bank navigation.
export const TRACK_NEXT = "/1/track+";
export const TRACK_PREV = "/1/track-";
export const BANK_NEXT = "/1/bank+";
export const BANK_PREV = "/1/bank-";

// --- Page 2: selected channel ------------------------------------------------

export const CH_VOLUME = "/2/volume";
export const CH_PAN = "/2/pan";
export const CH_MUTE = "/2/mute";
export const CH_SOLO = "/2/solo";
export const CH_PHANTOM = "/2/phantom";
export const CH_INSTRUMENT = "/2/instrument";
export const CH_PAD = "/2/pad";
export const CH_PHASE = "/2/phase";
export const CH_STEREO = "/2/stereo";
export const CH_LOOPBACK = "/2/loopback";
export const CH_CUE = "/2/cue";
export const CH_EQ_ENABLE = "/2/eqEnable";
export const CH_LOWCUT_ENABLE = "/2/lowcutEnable";
export const CH_COMP_ENABLE = "/2/compexpEnable";
export const CH_AUTOLEVEL_ENABLE = "/2/alevEnable";
export const CH_REVERB_SEND = "/2/reverbSend";
export const CH_RECORD_ENABLE = "/2/recordEnable";
export const CH_TRACK_NAME = "/2/trackname";

// --- Page 3: groups, snapshots, DuRec ----------------------------------------

/**
 * Mute/solo/fader group enables. Note the inversion in RME's addressing: group 1
 * is at index 4 and group 4 at index 1. This trips everyone up; the helpers below
 * take a human group number (1-4) and do the flip.
 */
const groupIndex = (group: number): number => 5 - group;

export const muteGroup = (group: number): string => `/3/muteGroups/${groupIndex(group)}/1`;
export const soloGroup = (group: number): string => `/3/soloGroups/${groupIndex(group)}/1`;
export const faderGroup = (group: number): string => `/3/faderGroups/${groupIndex(group)}/1`;

/**
 * Page an address belongs to.
 *
 * A remote controller slot mirrors one page at a time and TotalMix transmits
 * only the selected page's parameters. Derived from the address rather than a
 * parallel table.
 */
export function pageOf(address: string): 1 | 2 | 3 | 4 {
	const m = /^\/([1-4])\//.exec(address);
	return m === null ? 1 : (Number(m[1]) as 1 | 2 | 3 | 4);
}

/** Snapshots are similarly reversed: snapshot 1 is at index 8. */
export const snapshot = (n: number): string => `/3/snapshots/${9 - n}/1`;

// Continuous FX parameters (all kOSCScaleLin01 unless noted; Freq = log curve).
export const REVERB_VOLUME = "/3/reverbVolume";
export const REVERB_TIME = "/3/reverbTime";
export const REVERB_PREDELAY = "/3/reverbPredelay";
export const REVERB_WIDTH = "/3/reverbWidth";
export const ECHO_VOLUME = "/3/echoVolume";
export const ECHO_DELAY = "/3/echoDelaytime";
export const ECHO_FEEDBACK = "/3/echoFeedback";
export const CH_REVERB_RETURN = "/2/reverbReturn";
export const CH_LOWCUT_FREQ = "/2/lowcutFreq"; // kOSCScaleFreq

export const REVERB_ENABLE = "/3/reverbEnable";
export const ECHO_ENABLE = "/3/echoEnable";
export const UNDO = "/3/undo";
export const REDO = "/3/redo";

export const RECORD_START = "/3/recordRecordStart";
export const RECORD_PLAY_PAUSE = "/3/recordPlayPause";
export const RECORD_STOP = "/3/recordStop";
export const RECORD_TIME = "/3/recordTime";
export const RECORD_STATE = "/3/recordState";

// --- Page 4: Room EQ (page selection forces the Output bus) -------------------

/** Room EQ enable for the selected output channel. */
export const ROOM_EQ_ENABLE = "/4/reqEnable";

/** The display-string mirror TotalMix sends for a parameter, e.g. "/2/volumeVal". */
export const displayOf = (address: string): string => `${address}Val`;
