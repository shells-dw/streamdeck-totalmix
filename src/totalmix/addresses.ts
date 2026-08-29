/**
 * Address builders for the classic TotalMix FX OSC table (1.96, 22.07.2024).
 *
 * Addressing is control-element oriented: "/1/volume3" is the third fader of
 * the bank the slot currently shows, not channel 3. Bank start, bus and
 * submix move with the selectors below.
 */

export type Bus = "input" | "playback" | "output";

/** Faders per bank on page 1 (TotalMix default; configurable). */
export const DEFAULT_BANK_SIZE = 8;

// --- None-paged selectors (receive only) --------------------------------------

/** Selects a submix, 0 .. submixCount-1. */
export const SET_SUBMIX = "/setSubmix";

/** Selects a channel, 0 .. channelCount-1; becomes the page-1 bank start. */
export const SET_BANK_START = "/setBankStart";

/** Selects the page-2 channel relative to the bank start, counted in faders. */
export const SET_OFFSET_IN_BANK = "/setOffsetInBank";

/** Loads Quick Workspace 1..30. */
export const LOAD_QUICK_WORKSPACE = "/loadQuickWorkspace";

// --- Page 1: mixer -----------------------------------------------------------

/** Bus selector (kOSCScaleToggle, radio behaviour). */
export const bus = (b: Bus): string =>
	b === "input" ? "/1/busInput" : b === "playback" ? "/1/busPlayback" : "/1/busOutput";

/** Page-2 bus selector; selects the bus and moves the slot to page 2 without other side effects. */
export const busPage2 = (b: Bus): string =>
	b === "input" ? "/2/busInput" : b === "playback" ? "/2/busPlayback" : "/2/busOutput";

/** Strip fader, 1-based strip index (kOSCScaleFader, display kOSCScalePrintdB). */
export const volume = (strip: number): string => `/1/volume${strip}`;

/** Strip pan (kOSCScaleLin01, no display value on page 1). */
export const pan = (strip: number): string => `/1/pan${strip}`;

/** Page-1 per-strip switches use the grid form /1/<name>/1/<strip> and kOSCScaleOnOff. */
export const mute = (strip: number): string => `/1/mute/1/${strip}`;
export const solo = (strip: number): string => `/1/solo/1/${strip}`;
export const phantom = (strip: number): string => `/1/phantom/1/${strip}`;
export const cue = (strip: number): string => `/1/cue/1/${strip}`;

export const trackName = (strip: number): string => `/1/trackname${strip}`;


/** Input gain, input bus only; kOSCScaleLin01 over a device/channel-dependent span; applied to both sides of a stereo pair. */
export const micGain = (strip: number): string => `/1/micgain${strip}`;

export const LABEL_SUBMIX = "/1/labelSubmix";

// Main / control room. The table's name is "mastervolume".
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

// Bank navigation (kOSCScaleNoSend).
export const TRACK_NEXT = "/1/track+";
export const TRACK_PREV = "/1/track-";
export const BANK_NEXT = "/1/bank+";
export const BANK_PREV = "/1/bank-";

// --- Page 2: selected channel ------------------------------------------------
// No channel number in the address: the channel is bus + bank start + offset.

export const CH_VOLUME = "/2/volume";
export const CH_PAN = "/2/pan";
export const CH_MUTE = "/2/mute";
export const CH_SOLO = "/2/solo";
export const CH_PHANTOM = "/2/phantom";
export const CH_INSTRUMENT = "/2/instrument";
export const CH_PAD = "/2/pad";
export const CH_PHASE = "/2/phase";
export const CH_STEREO = "/2/stereo";
export const CH_PHASE_RIGHT = "/2/phaseRight";
/** Outputs only. */
export const CH_TALKBACK_SEL = "/2/talkbackSel";
/** Outputs only. */
export const CH_NO_TRIM = "/2/noTrim";
export const CH_MS_PROC = "/2/msProc";
export const CH_AUTOSET = "/2/autoset";
/** Outputs only. */
export const CH_LOOPBACK = "/2/loopback";
/** Outputs only. */
export const CH_CUE = "/2/cue";

// Parametric EQ. Types exist for bands 1 and 3 only (kOSCPrintSelection);
// gains kOSCScalePrintdB, frequencies kOSCScaleFreq, Q kOSCScaleLin01.
export const CH_EQ_ENABLE = "/2/eqEnable";
export const CH_EQ_TYPE1 = "/2/eqType1";
export const CH_EQ_GAIN1 = "/2/eqGain1";
export const CH_EQ_FREQ1 = "/2/eqFreq1";
export const CH_EQ_Q1 = "/2/eqQ1";
export const CH_EQ_GAIN2 = "/2/eqGain2";
export const CH_EQ_FREQ2 = "/2/eqFreq2";
export const CH_EQ_Q2 = "/2/eqQ2";
export const CH_EQ_TYPE3 = "/2/eqType3";
export const CH_EQ_GAIN3 = "/2/eqGain3";
export const CH_EQ_FREQ3 = "/2/eqFreq3";
export const CH_EQ_Q3 = "/2/eqQ3";

export const CH_LOWCUT_ENABLE = "/2/lowcutEnable";
/** kOSCScaleLin01, display kOSCPrintSelection. */
export const CH_LOWCUT_GRADE = "/2/lowcutGrade";
/** kOSCScaleFreq. */
export const CH_LOWCUT_FREQ = "/2/lowcutFreq";

// Dynamics: one enable and one make-up gain shared by compressor and expander.
// All kOSCScaleLin01; expander threshold spans -99..-20 dB since 1.96.
export const CH_COMP_ENABLE = "/2/compexpEnable";
export const CH_COMP_GAIN = "/2/compexpGain";
export const CH_COMP_ATTACK = "/2/compexpAttack";
export const CH_COMP_RELEASE = "/2/compexpRelease";
export const CH_COMP_THRESHOLD = "/2/compTrsh";
export const CH_COMP_RATIO = "/2/compRatio";
export const CH_EXP_THRESHOLD = "/2/expTrsh";
export const CH_EXP_RATIO = "/2/expRatio";

// Auto Level. Max gain steps 0.5 dB since 1.96.
export const CH_AUTOLEVEL_ENABLE = "/2/alevEnable";
export const CH_AUTOLEVEL_MAXGAIN = "/2/alevMaxgain";
export const CH_AUTOLEVEL_HEADROOM = "/2/alevHeadroom";
export const CH_AUTOLEVEL_RISETIME = "/2/alevRisetime";

/** FX send level (feeds reverb and echo). Inputs and playbacks only. */
export const CH_REVERB_SEND = "/2/reverbSend";
/** FX return level. Outputs only. */
export const CH_REVERB_RETURN = "/2/reverbReturn";
export const CH_RECORD_ENABLE = "/2/recordEnable";
export const CH_TRACK_NAME = "/2/trackname";

// --- Page 3: FX, groups, snapshots, DURec -------------------------------------

/** Group addresses are reversed: group 1 is index 4, group 4 index 1. */
const groupIndex = (group: number): number => 5 - Math.min(4, Math.max(1, Math.round(group)));

export const muteGroup = (group: number): string => `/3/muteGroups/${groupIndex(group)}/1`;
export const soloGroup = (group: number): string => `/3/soloGroups/${groupIndex(group)}/1`;
export const faderGroup = (group: number): string => `/3/faderGroups/${groupIndex(group)}/1`;

/** Snapshot addresses are reversed: snapshot 1 is index 8, snapshot 8 index 1. */
export const snapshot = (n: number): string =>
	`/3/snapshots/${9 - Math.min(8, Math.max(1, Math.round(n)))}/1`;

/** Page number from the address prefix; none-paged addresses map to page 1. */
export function pageOf(address: string): 1 | 2 | 3 | 4 {
	const m = /^\/([1-4])\//.exec(address);
	return m === null ? 1 : (Number(m[1]) as 1 | 2 | 3 | 4);
}

// Reverb unit (kOSCScaleLin01 unless noted).
export const REVERB_VOLUME = "/3/reverbVolume";
export const REVERB_PREDELAY = "/3/reverbPredelay";
export const REVERB_WIDTH = "/3/reverbWidth";
export const REVERB_LOWCUT = "/3/reverbLowcut"; // kOSCScaleFreq
export const REVERB_HIGHCUT = "/3/reverbHighcut"; // kOSCScaleFreq
export const REVERB_ROOMSCALE = "/3/reverbRoomscale";
export const REVERB_SMOOTH = "/3/reverbSmooth";
export const REVERB_TIME = "/3/reverbTime"; // Space type only
export const REVERB_HIGHDAMP = "/3/reverbHighdamp"; // Space type only, kOSCScaleFreq
export const REVERB_ATTACK = "/3/reverbAttack"; // Envelope types only
export const REVERB_HOLD = "/3/reverbHold"; // Envelope types only
export const REVERB_RELEASE = "/3/reverbRelease"; // Envelope types only

// Echo unit.
export const ECHO_VOLUME = "/3/echoVolume";
export const ECHO_DELAY = "/3/echoDelaytime";
export const ECHO_FEEDBACK = "/3/echoFeedback";
export const ECHO_WIDTH = "/3/echoWidth";

export const REVERB_ENABLE = "/3/reverbEnable";
export const ECHO_ENABLE = "/3/echoEnable";
export const UNDO = "/3/undo";
export const REDO = "/3/redo";

// DURec.
export const RECORD_START = "/3/recordRecordStart";
export const RECORD_PLAY_PAUSE = "/3/recordPlayPause";
export const RECORD_STOP = "/3/recordStop";
export const RECORD_TIME = "/3/recordTime";
export const RECORD_STATE = "/3/recordState";

// --- Page 4: Room EQ (selecting page 4 selects the Output bus) ----------------

export const ROOM_EQ_ENABLE = "/4/reqEnable";
export const ROOM_EQ_TRACK_NAME = "/4/trackname";
/** Toggles selecting which half of the output pair the page-4 parameters address; both on = display left, write both. */
export const ROOM_EQ_LEFT = "/4/leftChannel";
export const ROOM_EQ_RIGHT = "/4/rightChannel";
export const ROOM_EQ_DELAY = "/4/reqDelay"; // kOSCScaleLin01
export const ROOM_EQ_VOLUME_CORR = "/4/reqVolumeCorr"; // kOSCScaleLin01, displayed in dB

const roomEqBand = (n: number): number => Math.min(9, Math.max(1, Math.round(n)));

/** Band characteristics, kOSCScaleLin01 spread over Bell, Shelf, High Pass, Low Pass; bands 1, 8 and 9 only. */
export const roomEqType = (band: 1 | 8 | 9): string => `/4/reqType${band}`;
export const roomEqGain = (band: number): string => `/4/reqGain${roomEqBand(band)}`; // kOSCScaleLin01
export const roomEqFreq = (band: number): string => `/4/reqFreq${roomEqBand(band)}`; // kOSCScaleFreq
export const roomEqQ = (band: number): string => `/4/reqQ${roomEqBand(band)}`; // kOSCScaleLin01

/** Display-string address for a parameter, e.g. "/2/volumeVal". */
export const displayOf = (address: string): string => `${address}Val`;
