import streamDeck from "@elgato/streamdeck";
import { Select } from "./actions/select.js";
import { Toggle } from "./actions/toggle.js";
import { Volume } from "./actions/volume.js";
import { disposeAll } from "./totalmix/connection.js";

streamDeck.actions.registerAction(new Volume());
streamDeck.actions.registerAction(new Toggle());
streamDeck.actions.registerAction(new Select());

// A UDP listener must survive anything TotalMix or the network throws at it.
// Without these, one unexpected rejection takes the whole plugin down and every
// button goes dead until the user restarts Stream Deck.
process.on("uncaughtException", (err) => {
    streamDeck.logger.error(`Uncaught exception: ${err.stack ?? err.message}`);
});

process.on("unhandledRejection", (reason) => {
    streamDeck.logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on("exit", () => disposeAll());

await streamDeck.connect();
