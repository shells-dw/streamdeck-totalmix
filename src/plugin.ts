import streamDeck from "@elgato/streamdeck";
import { GlobalDisplay } from "./actions/global-display.js";
import { GlobalToggle } from "./actions/global-toggle.js";
import { GlobalTrigger } from "./actions/global-trigger.js";
import { GlobalVolume } from "./actions/global-volume.js";
import { Select } from "./actions/select.js";
import { Toggle } from "./actions/toggle.js";
import { Volume } from "./actions/volume.js";
import { disposeAllGlobal } from "./globalosc/connection.js";
import { disposeAll } from "./totalmix/connection.js";

streamDeck.actions.registerAction(new Volume());
streamDeck.actions.registerAction(new Toggle());
streamDeck.actions.registerAction(new Select());
// Global OSC actions (TotalMix FX 2.1+): absolute addressing, own controller slot.
streamDeck.actions.registerAction(new GlobalVolume());
streamDeck.actions.registerAction(new GlobalToggle());
streamDeck.actions.registerAction(new GlobalTrigger());
streamDeck.actions.registerAction(new GlobalDisplay());

// A UDP listener must survive anything TotalMix or the network throws at it.
// Without these, one unexpected rejection takes the whole plugin down and every
// button goes dead until the user restarts Stream Deck.
process.on("uncaughtException", (err) => {
    streamDeck.logger.error(`Uncaught exception: ${err.stack ?? err.message}`);
});

process.on("unhandledRejection", (reason) => {
    streamDeck.logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on("exit", () => {
    disposeAll();
    disposeAllGlobal();
});

await streamDeck.connect();
