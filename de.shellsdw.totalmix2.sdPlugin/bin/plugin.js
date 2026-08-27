import require$$0$3 from 'events';
import require$$1$1 from 'https';
import require$$2$1 from 'http';
import require$$3 from 'net';
import require$$4 from 'tls';
import require$$1 from 'crypto';
import require$$0$2 from 'stream';
import require$$7 from 'url';
import require$$0 from 'zlib';
import require$$0$1 from 'buffer';
import require$$2 from 'util';
import fs, { existsSync, readFileSync } from 'node:fs';
import path, { join } from 'node:path';
import { cwd } from 'node:process';
import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';

/**
 * Default language supported by all i18n providers.
 */
const defaultLanguage = "en";

/**
 * Creates a {@link IDisposable} that defers the disposing to the {@link dispose} function; disposing is guarded so that it may only occur once.
 * @param dispose Function responsible for disposing.
 * @returns Disposable whereby the disposing is delegated to the {@link dispose}  function.
 */
function deferredDisposable(dispose) {
    let isDisposed = false;
    const guardedDispose = () => {
        if (!isDisposed) {
            dispose();
            isDisposed = true;
        }
    };
    return {
        [Symbol.dispose]: guardedDispose,
        dispose: guardedDispose,
    };
}

/**
 * An event emitter that enables the listening for, and emitting of, events.
 */
class EventEmitter {
    /**
     * Underlying collection of events and their listeners.
     */
    events = new Map();
    /**
     * Adds the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the {@link listener} added.
     */
    addListener(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.push({ listener }));
    }
    /**
     * Adds the event {@link listener} for the event named {@link eventName}, and returns a disposable capable of removing the event listener.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns A disposable that removes the listener when disposed.
     */
    disposableOn(eventName, listener) {
        this.add(eventName, listener, (listeners) => listeners.push({ listener }));
        return deferredDisposable(() => this.removeListener(eventName, listener));
    }
    /**
     * Emits the {@link eventName}, invoking all event listeners with the specified {@link args}.
     * @param eventName Name of the event.
     * @param args Arguments supplied to each event listener.
     * @returns `true` when there was a listener associated with the event; otherwise `false`.
     */
    emit(eventName, ...args) {
        const listeners = this.events.get(eventName);
        if (listeners === undefined) {
            return false;
        }
        for (let i = 0; i < listeners.length;) {
            const { listener, once } = listeners[i];
            if (once) {
                this.remove(eventName, listeners, i);
            }
            else {
                i++;
            }
            listener(...args);
        }
        return true;
    }
    /**
     * Gets the event names with event listeners.
     * @returns Event names.
     */
    eventNames() {
        return Array.from(this.events.keys());
    }
    /**
     * Gets the number of event listeners for the event named {@link eventName}. When a {@link listener} is defined, only matching event listeners are counted.
     * @param eventName Name of the event.
     * @param listener Optional event listener to count.
     * @returns Number of event listeners.
     */
    listenerCount(eventName, listener) {
        const listeners = this.events.get(eventName);
        if (listeners === undefined || listener == undefined) {
            return listeners?.length || 0;
        }
        let count = 0;
        listeners.forEach((ev) => {
            if (ev.listener === listener) {
                count++;
            }
        });
        return count;
    }
    /**
     * Gets the event listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @returns The event listeners.
     */
    listeners(eventName) {
        return Array.from(this.events.get(eventName) || []).map(({ listener }) => listener);
    }
    /**
     * Removes the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} removed.
     */
    off(eventName, listener) {
        const listeners = this.events.get(eventName) ?? [];
        for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i].listener === listener) {
                this.remove(eventName, listeners, i);
            }
        }
        return this;
    }
    /**
     * Adds the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} added.
     */
    on(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.push({ listener }));
    }
    /**
     * Adds the **one-time** event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} added.
     */
    once(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.push({ listener, once: true }));
    }
    /**
     * Adds the event {@link listener} to the beginning of the listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} prepended.
     */
    prependListener(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.splice(0, 0, { listener }));
    }
    /**
     * Adds the **one-time** event {@link listener} to the beginning of the listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} prepended.
     */
    prependOnceListener(eventName, listener) {
        return this.add(eventName, listener, (listeners) => listeners.splice(0, 0, { listener, once: true }));
    }
    /**
     * Removes all event listeners for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @returns This instance with the event listeners removed
     */
    removeAllListeners(eventName) {
        const listeners = this.events.get(eventName) ?? [];
        while (listeners.length > 0) {
            this.remove(eventName, listeners, 0);
        }
        this.events.delete(eventName);
        return this;
    }
    /**
     * Removes the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @returns This instance with the event {@link listener} removed.
     */
    removeListener(eventName, listener) {
        return this.off(eventName, listener);
    }
    /**
     * Adds the event {@link listener} for the event named {@link eventName}.
     * @param eventName Name of the event.
     * @param listener Event handler function.
     * @param fn Function responsible for adding the new event handler function.
     * @returns This instance with event {@link listener} added.
     */
    add(eventName, listener, fn) {
        let listeners = this.events.get(eventName);
        if (listeners === undefined) {
            listeners = [];
            this.events.set(eventName, listeners);
        }
        fn(listeners);
        if (eventName !== "newListener") {
            const args = [eventName, listener];
            this.emit("newListener", ...args);
        }
        return this;
    }
    /**
     * Removes the listener at the given index.
     * @param eventName Name of the event.
     * @param listeners Listeners registered with the event.
     * @param index Index of the listener to remove.
     */
    remove(eventName, listeners, index) {
        const [{ listener }] = listeners.splice(index, 1);
        if (eventName !== "removeListener") {
            const args = [eventName, listener];
            this.emit("removeListener", ...args);
        }
    }
}

/**
 * Prevents the modification of existing property attributes and values on the value, and all of its child properties, and prevents the addition of new properties.
 * @param value Value to freeze.
 */
function freeze(value) {
    if (value !== undefined && value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(freeze);
    }
}

/**
 * Gets the value at the specified {@link path}.
 * @param source Source object that is being read from.
 * @param path Path to the property to get.
 * @returns Value of the property.
 */
function get(source, path) {
    const props = path.split(".");
    return props.reduce((obj, prop) => obj && obj[prop], source);
}

/**
 * “Internationalization (i18n) provider, responsible for managing localizations and translating resources.
 */
class I18nProvider {
    /**
     * Backing field for the default language.
     */
    #language;
    /**
     * Map of localized resources, indexed by their language.
     */
    #translations = new Map();
    /**
     * Function responsible for providing localized resources for a given language.
     */
    #readTranslations;
    /**
     * Internal events handler.
     */
    #events = new EventEmitter();
    /**
     * Initializes a new instance of the {@link I18nProvider} class.
     * @param language The default language to be used when retrieving translations for a given key.
     * @param readTranslations Function responsible for providing localized resources for a given language.
     */
    constructor(language, readTranslations) {
        this.#language = language;
        this.#readTranslations = readTranslations;
    }
    /**
     * The default language of the provider.
     * @returns The language.
     */
    get language() {
        return this.#language;
    }
    /**
     * The default language of the provider.
     * @param value The language.
     */
    set language(value) {
        if (this.#language !== value) {
            this.#language = value;
            this.#events.emit("languageChange", value);
        }
    }
    /**
     * Adds an event listener that is called when the language within the provider changes.
     * @param listener Listener function to be called.
     * @returns Resource manager that, when disposed, removes the event listener.
     */
    onLanguageChange(listener) {
        return this.#events.disposableOn("languageChange", listener);
    }
    /**
     * Translates the specified {@link key}, as defined within the resources for the {@link language}.
     * When the key is not found, the default language is checked. Alias of {@link I18nProvider.translate}.
     * @param key Key of the translation.
     * @param language Optional language to get the translation for; otherwise the default language.
     * @returns The translation; otherwise the key.
     */
    t(key, language = this.language) {
        return this.translate(key, language);
    }
    /**
     * Translates the specified {@link key}, as defined within the resources for the {@link language}.
     * When the key is not found, the default language is checked.
     * @param key Key of the translation.
     * @param language Optional language to get the translation for; otherwise the default language.
     * @returns The translation; otherwise the key.
     */
    translate(key, language = this.language) {
        // Determine the languages to search for.
        const languages = new Set([
            language,
            language.replaceAll("_", "-").split("-").at(0),
            defaultLanguage,
        ]);
        // Attempt to find the resource for the languages.
        for (const language of languages) {
            const resource = get(this.getTranslations(language), key);
            if (resource) {
                return resource.toString();
            }
        }
        // Otherwise fallback to the key.
        return key;
    }
    /**
     * Gets the translations for the specified language.
     * @param language Language whose translations are being retrieved.
     * @returns The translations; otherwise `null`.
     */
    getTranslations(language) {
        let translations = this.#translations.get(language);
        if (translations === undefined) {
            translations = this.#readTranslations(language);
            freeze(translations);
            this.#translations.set(language, translations);
        }
        return translations;
    }
}

/**
 * Provides a read-only iterable collection of items that also acts as a partial polyfill for iterator helpers.
 */
class Enumerable {
    /**
     * Backing function responsible for providing the iterator of items.
     */
    #items;
    /**
     * Backing function for {@link Enumerable.length}.
     */
    #length;
    /**
     * Captured iterator from the underlying iterable; used to fulfil {@link IterableIterator} methods.
     */
    #iterator;
    /**
     * Initializes a new instance of the {@link Enumerable} class.
     * @param source Source that contains the items.
     * @returns The enumerable.
     */
    constructor(source) {
        if (source instanceof Enumerable) {
            // Enumerable
            this.#items = source.#items;
            this.#length = source.#length;
        }
        else if (Array.isArray(source)) {
            // Array
            this.#items = () => source.values();
            this.#length = () => source.length;
        }
        else if (source instanceof Map || source instanceof Set) {
            // Map or Set
            this.#items = () => source.values();
            this.#length = () => source.size;
        }
        else {
            // IterableIterator delegate
            this.#items = source;
            this.#length = () => {
                let i = 0;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                for (const _ of this) {
                    i++;
                }
                return i;
            };
        }
    }
    /**
     * Gets the number of items in the enumerable.
     * @returns The number of items.
     */
    get length() {
        return this.#length();
    }
    /**
     * Gets the iterator for the enumerable.
     * @yields The items.
     */
    *[Symbol.iterator]() {
        for (const item of this.#items()) {
            yield item;
        }
    }
    /**
     * Transforms each item within this iterator to an indexed pair, with each pair represented as an array.
     * @returns An iterator of indexed pairs.
     */
    asIndexedPairs() {
        return new Enumerable(function* () {
            let i = 0;
            for (const item of this) {
                yield [i++, item];
            }
        }.bind(this));
    }
    /**
     * Returns an iterator with the first items dropped, up to the specified limit.
     * @param limit The number of elements to drop from the start of the iteration.
     * @returns An iterator of items after the limit.
     */
    drop(limit) {
        if (isNaN(limit) || limit < 0) {
            throw new RangeError("limit must be 0, or a positive number");
        }
        return new Enumerable(function* () {
            let i = 0;
            for (const item of this) {
                if (i++ >= limit) {
                    yield item;
                }
            }
        }.bind(this));
    }
    /**
     * Determines whether all items satisfy the specified predicate.
     * @param predicate Function that determines whether each item fulfils the predicate.
     * @returns `true` when all items satisfy the predicate; otherwise `false`.
     */
    every(predicate) {
        for (const item of this) {
            if (!predicate(item)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Returns an iterator of items that meet the specified predicate..
     * @param predicate Function that determines which items to filter.
     * @returns An iterator of filtered items.
     */
    filter(predicate) {
        return new Enumerable(function* () {
            for (const item of this) {
                if (predicate(item)) {
                    yield item;
                }
            }
        }.bind(this));
    }
    /**
     * Finds the first item that satisfies the specified predicate.
     * @param predicate Predicate to match items against.
     * @returns The first item that satisfied the predicate; otherwise `undefined`.
     */
    find(predicate) {
        for (const item of this) {
            if (predicate(item)) {
                return item;
            }
        }
    }
    /**
     * Finds the last item that satisfies the specified predicate.
     * @param predicate Predicate to match items against.
     * @returns The first item that satisfied the predicate; otherwise `undefined`.
     */
    findLast(predicate) {
        let result = undefined;
        for (const item of this) {
            if (predicate(item)) {
                result = item;
            }
        }
        return result;
    }
    /**
     * Returns an iterator containing items transformed using the specified mapper function.
     * @param mapper Function responsible for transforming each item.
     * @returns An iterator of transformed items.
     */
    flatMap(mapper) {
        return new Enumerable(function* () {
            for (const item of this) {
                for (const mapped of mapper(item)) {
                    yield mapped;
                }
            }
        }.bind(this));
    }
    /**
     * Iterates over each item, and invokes the specified function.
     * @param fn Function to invoke against each item.
     */
    forEach(fn) {
        for (const item of this) {
            fn(item);
        }
    }
    /**
     * Determines whether the search item exists in the collection exists.
     * @param search Item to search for.
     * @returns `true` when the item was found; otherwise `false`.
     */
    includes(search) {
        return this.some((item) => item === search);
    }
    /**
     * Returns an iterator of mapped items using the mapper function.
     * @param mapper Function responsible for mapping the items.
     * @returns An iterator of mapped items.
     */
    map(mapper) {
        return new Enumerable(function* () {
            for (const item of this) {
                yield mapper(item);
            }
        }.bind(this));
    }
    /**
     * Captures the underlying iterable, if it is not already captured, and gets the next item in the iterator.
     * @param args Optional values to send to the generator.
     * @returns An iterator result of the current iteration; when `done` is `false`, the current `value` is provided.
     */
    next(...args) {
        this.#iterator ??= this.#items();
        const result = this.#iterator.next(...args);
        if (result.done) {
            this.#iterator = undefined;
        }
        return result;
    }
    /**
     * Applies the accumulator function to each item, and returns the result.
     * @param accumulator Function responsible for accumulating all items within the collection.
     * @param initial Initial value supplied to the accumulator.
     * @returns Result of accumulating each value.
     */
    reduce(accumulator, initial) {
        if (this.length === 0) {
            if (initial === undefined) {
                throw new TypeError("Reduce of empty enumerable with no initial value.");
            }
            return initial;
        }
        let result = initial;
        for (const item of this) {
            if (result === undefined) {
                result = item;
            }
            else {
                result = accumulator(result, item);
            }
        }
        return result;
    }
    /**
     * Acts as if a `return` statement is inserted in the generator's body at the current suspended position.
     *
     * Please note, in the context of an {@link Enumerable}, calling {@link Enumerable.return} will clear the captured iterator,
     * if there is one. Subsequent calls to {@link Enumerable.next} will result in re-capturing the underlying iterable, and
     * yielding items from the beginning.
     * @param value Value to return.
     * @returns The value as an iterator result.
     */
    return(value) {
        this.#iterator = undefined;
        return { done: true, value };
    }
    /**
     * Determines whether an item in the collection exists that satisfies the specified predicate.
     * @param predicate Function used to search for an item.
     * @returns `true` when the item was found; otherwise `false`.
     */
    some(predicate) {
        for (const item of this) {
            if (predicate(item)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Returns an iterator with the items, from 0, up to the specified limit.
     * @param limit Limit of items to take.
     * @returns An iterator of items from 0 to the limit.
     */
    take(limit) {
        if (isNaN(limit) || limit < 0) {
            throw new RangeError("limit must be 0, or a positive number");
        }
        return new Enumerable(function* () {
            let i = 0;
            for (const item of this) {
                if (i++ < limit) {
                    yield item;
                }
            }
        }.bind(this));
    }
    /**
     * Acts as if a `throw` statement is inserted in the generator's body at the current suspended position.
     * @param e Error to throw.
     */
    throw(e) {
        throw e;
    }
    /**
     * Converts this iterator to an array.
     * @returns The array of items from this iterator.
     */
    toArray() {
        return Array.from(this);
    }
    /**
     * Converts this iterator to serializable collection.
     * @returns The serializable collection of items.
     */
    toJSON() {
        return this.toArray();
    }
    /**
     * Converts this iterator to a string.
     * @returns The string.
     */
    toString() {
        return `${this.toArray()}`;
    }
}

// Polyfill, explicit resource management https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Symbol.dispose ??= Symbol("Symbol.dispose");

/**
 * Provides a wrapper around a value that is lazily instantiated.
 */
class Lazy {
    /**
     * Private backing field for {@link Lazy.value}.
     */
    #value = undefined;
    /**
     * Factory responsible for instantiating the value.
     */
    #valueFactory;
    /**
     * Initializes a new instance of the {@link Lazy} class.
     * @param valueFactory The factory responsible for instantiating the value.
     */
    constructor(valueFactory) {
        this.#valueFactory = valueFactory;
    }
    /**
     * Gets the value.
     * @returns The value.
     */
    get value() {
        if (this.#value === undefined) {
            this.#value = this.#valueFactory();
        }
        return this.#value;
    }
}

/**
 * Returns an object that contains a promise and two functions to resolve or reject it.
 * @returns The promise, and the resolve and reject functions.
 */
function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** A special constant with type `never` */
function $constructor(name, initializer, params) {
    function init(inst, def) {
        var _a;
        Object.defineProperty(inst, "_zod", {
            value: inst._zod ?? {},
            enumerable: false,
        });
        (_a = inst._zod).traits ?? (_a.traits = new Set());
        inst._zod.traits.add(name);
        initializer(inst, def);
        // support prototype modifications
        for (const k in _.prototype) {
            if (!(k in inst))
                Object.defineProperty(inst, k, { value: _.prototype[k].bind(inst) });
        }
        inst._zod.constr = _;
        inst._zod.def = def;
    }
    // doesn't work if Parent has a constructor with arguments
    const Parent = params?.Parent ?? Object;
    class Definition extends Parent {
    }
    Object.defineProperty(Definition, "name", { value: name });
    function _(def) {
        var _a;
        const inst = params?.Parent ? new Definition() : this;
        init(inst, def);
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        for (const fn of inst._zod.deferred) {
            fn();
        }
        return inst;
    }
    Object.defineProperty(_, "init", { value: init });
    Object.defineProperty(_, Symbol.hasInstance, {
        value: (inst) => {
            if (params?.Parent && inst instanceof params.Parent)
                return true;
            return inst?._zod?.traits?.has(name);
        },
    });
    Object.defineProperty(_, "name", { value: name });
    return _;
}
class $ZodAsyncError extends Error {
    constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
}
const globalConfig = {};
function config(newConfig) {
    return globalConfig;
}

// functions
function jsonStringifyReplacer(_, value) {
    if (typeof value === "bigint")
        return value.toString();
    return value;
}
function cached(getter) {
    return {
        get value() {
            {
                const value = getter();
                Object.defineProperty(this, "value", { value });
                return value;
            }
        },
    };
}
function cleanRegex(source) {
    const start = source.startsWith("^") ? 1 : 0;
    const end = source.endsWith("$") ? source.length - 1 : source.length;
    return source.slice(start, end);
}
function defineLazy(object, key, getter) {
    Object.defineProperty(object, key, {
        get() {
            {
                const value = getter();
                object[key] = value;
                return value;
            }
        },
        set(v) {
            Object.defineProperty(object, key, {
                value: v,
                // configurable: true,
            });
            // object[key] = v;
        },
        configurable: true,
    });
}
function assignProp(target, prop, value) {
    Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
function esc(str) {
    return JSON.stringify(str);
}
const captureStackTrace = Error.captureStackTrace
    ? Error.captureStackTrace
    : (..._args) => { };
function isObject(data) {
    return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = cached(() => {
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
        return false;
    }
    try {
        const F = Function;
        new F("");
        return true;
    }
    catch (_) {
        return false;
    }
});
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// zod-specific utils
function clone(inst, def, params) {
    const cl = new inst._zod.constr(def ?? inst._zod.def);
    if (!def || params?.parent)
        cl._zod.parent = inst;
    return cl;
}
function normalizeParams(_params) {
    return {};
}
function optionalKeys(shape) {
    return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
    });
}
function aborted(x, startIndex = 0) {
    for (let i = startIndex; i < x.issues.length; i++) {
        if (x.issues[i]?.continue !== true)
            return true;
    }
    return false;
}
function prefixIssues(path, issues) {
    return issues.map((iss) => {
        var _a;
        (_a = iss).path ?? (_a.path = []);
        iss.path.unshift(path);
        return iss;
    });
}
function unwrapMessage(message) {
    return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
    const full = { ...iss, path: iss.path ?? [] };
    // for backwards compatibility
    if (!iss.message) {
        const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ??
            unwrapMessage(ctx?.error?.(iss)) ??
            unwrapMessage(config.customError?.(iss)) ??
            unwrapMessage(config.localeError?.(iss)) ??
            "Invalid input";
        full.message = message;
    }
    // delete (full as any).def;
    delete full.inst;
    delete full.continue;
    if (!ctx?.reportInput) {
        delete full.input;
    }
    return full;
}

const initializer = (inst, def) => {
    inst.name = "$ZodError";
    Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false,
    });
    Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false,
    });
    Object.defineProperty(inst, "message", {
        get() {
            return JSON.stringify(def, jsonStringifyReplacer, 2);
        },
        enumerable: true,
        // configurable: false,
    });
    Object.defineProperty(inst, "toString", {
        value: () => inst.message,
        enumerable: false,
    });
};
const $ZodError = $constructor("$ZodError", initializer);
const $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });

const _parse = (_Err) => (schema, value, _ctx, _params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, _params?.callee);
        throw e;
    }
    return result.value;
};
const parse = /* @__PURE__*/ _parse($ZodRealError);
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, params?.callee);
        throw e;
    }
    return result.value;
};
const parseAsync = /* @__PURE__*/ _parseAsync($ZodRealError);
const _safeParse = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    return result.issues.length
        ? {
            success: false,
            error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParse = /* @__PURE__*/ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    return result.issues.length
        ? {
            success: false,
            error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParseAsync = /* @__PURE__*/ _safeParseAsync($ZodRealError);

const string$1 = (params) => {
    const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
    return new RegExp(`^${regex}$`);
};
const number$1 = /^-?\d+(?:\.\d+)?/i;
const boolean$1 = /true|false/i;

class Doc {
    constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
            this.args = args;
    }
    indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
    }
    write(arg) {
        if (typeof arg === "function") {
            arg(this, { execution: "sync" });
            arg(this, { execution: "async" });
            return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
            this.content.push(line);
        }
    }
    compile() {
        const F = Function;
        const args = this?.args;
        const content = this?.content ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        // console.log(lines.join("\n"));
        return new F(...args, lines.join("\n"));
    }
}

const version = {
    major: 4,
    minor: 0,
    patch: 0,
};

const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def; // set _def property
    inst._zod.bag = inst._zod.bag || {}; // initialize _bag object
    inst._zod.version = version;
    const checks = [...(inst._zod.def.checks ?? [])];
    // if inst is itself a checks.$ZodCheck, run it as a check
    if (inst._zod.traits.has("$ZodCheck")) {
        checks.unshift(inst);
    }
    //
    for (const ch of checks) {
        for (const fn of ch._zod.onattach) {
            fn(inst);
        }
    }
    if (checks.length === 0) {
        // deferred initializer
        // inst._zod.parse is not yet defined
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        inst._zod.deferred?.push(() => {
            inst._zod.run = inst._zod.parse;
        });
    }
    else {
        const runChecks = (payload, checks, ctx) => {
            let isAborted = aborted(payload);
            let asyncResult;
            for (const ch of checks) {
                if (ch._zod.def.when) {
                    const shouldRun = ch._zod.def.when(payload);
                    if (!shouldRun)
                        continue;
                }
                else if (isAborted) {
                    continue;
                }
                const currLen = payload.issues.length;
                const _ = ch._zod.check(payload);
                if (_ instanceof Promise && ctx?.async === false) {
                    throw new $ZodAsyncError();
                }
                if (asyncResult || _ instanceof Promise) {
                    asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                        await _;
                        const nextLen = payload.issues.length;
                        if (nextLen === currLen)
                            return;
                        if (!isAborted)
                            isAborted = aborted(payload, currLen);
                    });
                }
                else {
                    const nextLen = payload.issues.length;
                    if (nextLen === currLen)
                        continue;
                    if (!isAborted)
                        isAborted = aborted(payload, currLen);
                }
            }
            if (asyncResult) {
                return asyncResult.then(() => {
                    return payload;
                });
            }
            return payload;
        };
        inst._zod.run = (payload, ctx) => {
            const result = inst._zod.parse(payload, ctx);
            if (result instanceof Promise) {
                if (ctx.async === false)
                    throw new $ZodAsyncError();
                return result.then((result) => runChecks(result, checks, ctx));
            }
            return runChecks(result, checks, ctx);
        };
    }
    inst["~standard"] = {
        validate: (value) => {
            try {
                const r = safeParse(inst, value);
                return r.success ? { value: r.data } : { issues: r.error?.issues };
            }
            catch (_) {
                return safeParseAsync(inst, value).then((r) => (r.success ? { value: r.data } : { issues: r.error?.issues }));
            }
        },
        vendor: "zod",
        version: 1,
    };
});
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...(inst?._zod.bag?.patterns ?? [])].pop() ?? string$1(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
        if (def.coerce)
            try {
                payload.value = String(payload.value);
            }
            catch (_) { }
        if (typeof payload.value === "string")
            return payload;
        payload.issues.push({
            expected: "string",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Number(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
            return payload;
        }
        const received = typeof input === "number"
            ? Number.isNaN(input)
                ? "NaN"
                : !Number.isFinite(input)
                    ? "Infinity"
                    : undefined
            : undefined;
        payload.issues.push({
            expected: "number",
            code: "invalid_type",
            input,
            inst,
            ...(received ? { received } : {}),
        });
        return payload;
    };
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Boolean(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "boolean")
            return payload;
        payload.issues.push({
            expected: "boolean",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
function handleArrayResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                expected: "array",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const result = def.element._zod.run({
                value: item,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleArrayResult(result, payload, i)));
            }
            else {
                handleArrayResult(result, payload, i);
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload; //handleArrayResultsAsync(parseResults, final);
    };
});
function handleObjectResult(result, final, key) {
    // if(isOptional)
    if (result.issues.length) {
        final.issues.push(...prefixIssues(key, result.issues));
    }
    final.value[key] = result.value;
}
function handleOptionalObjectResult(result, final, key, input) {
    if (result.issues.length) {
        // validation failed against value schema
        if (input[key] === undefined) {
            // if input was undefined, ignore the error
            if (key in input) {
                final.value[key] = undefined;
            }
            else {
                final.value[key] = result.value;
            }
        }
        else {
            final.issues.push(...prefixIssues(key, result.issues));
        }
    }
    else if (result.value === undefined) {
        // validation returned `undefined`
        if (key in input)
            final.value[key] = undefined;
    }
    else {
        // non-undefined value
        final.value[key] = result.value;
    }
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodType.init(inst, def);
    const _normalized = cached(() => {
        const keys = Object.keys(def.shape);
        for (const k of keys) {
            if (!(def.shape[k] instanceof $ZodType)) {
                throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
            }
        }
        const okeys = optionalKeys(def.shape);
        return {
            shape: def.shape,
            keys,
            keySet: new Set(keys),
            numKeys: keys.length,
            optionalKeys: new Set(okeys),
        };
    });
    defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
            const field = shape[key]._zod;
            if (field.values) {
                propValues[key] ?? (propValues[key] = new Set());
                for (const v of field.values)
                    propValues[key].add(v);
            }
        }
        return propValues;
    });
    const generateFastpass = (shape) => {
        const doc = new Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = (key) => {
            const k = esc(key);
            return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        };
        doc.write(`const input = payload.value;`);
        const ids = Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
            ids[key] = `key_${counter++}`;
        }
        // A: preserve key order {
        doc.write(`const newResult = {}`);
        for (const key of normalized.keys) {
            if (normalized.optionalKeys.has(key)) {
                const id = ids[key];
                doc.write(`const ${id} = ${parseStr(key)};`);
                const k = esc(key);
                doc.write(`
        if (${id}.issues.length) {
          if (input[${k}] === undefined) {
            if (${k} in input) {
              newResult[${k}] = undefined;
            }
          } else {
            payload.issues = payload.issues.concat(
              ${id}.issues.map((iss) => ({
                ...iss,
                path: iss.path ? [${k}, ...iss.path] : [${k}],
              }))
            );
          }
        } else if (${id}.value === undefined) {
          if (${k} in input) newResult[${k}] = undefined;
        } else {
          newResult[${k}] = ${id}.value;
        }
        `);
            }
            else {
                const id = ids[key];
                //  const id = ids[key];
                doc.write(`const ${id} = ${parseStr(key)};`);
                doc.write(`
          if (${id}.issues.length) payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${esc(key)}, ...iss.path] : [${esc(key)}]
          })));`);
                doc.write(`newResult[${esc(key)}] = ${id}.value`);
            }
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject$1 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval$1 = allowsEval;
    const fastEnabled = jit && allowsEval$1.value; // && !def.catchall;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        const proms = [];
        if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
            // always synchronous
            if (!fastpass)
                fastpass = generateFastpass(def.shape);
            payload = fastpass(payload, ctx);
        }
        else {
            payload.value = {};
            const shape = value.shape;
            for (const key of value.keys) {
                const el = shape[key];
                // do not add omitted optional keys
                // if (!(key in input)) {
                //   if (optionalKeys.has(key)) continue;
                //   payload.issues.push({
                //     code: "invalid_type",
                //     path: [key],
                //     expected: "nonoptional",
                //     note: `Missing required key: "${key}"`,
                //     input,
                //     inst,
                //   });
                // }
                const r = el._zod.run({ value: input[key], issues: [] }, ctx);
                const isOptional = el._zod.optin === "optional" && el._zod.optout === "optional";
                if (r instanceof Promise) {
                    proms.push(r.then((r) => isOptional ? handleOptionalObjectResult(r, payload, key, input) : handleObjectResult(r, payload, key)));
                }
                else if (isOptional) {
                    handleOptionalObjectResult(r, payload, key, input);
                }
                else {
                    handleObjectResult(r, payload, key);
                }
            }
        }
        if (!catchall) {
            // return payload;
            return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        const unrecognized = [];
        // iterate over input keys
        const keySet = value.keySet;
        const _catchall = catchall._zod;
        const t = _catchall.def.type;
        for (const key of Object.keys(input)) {
            if (keySet.has(key))
                continue;
            if (t === "never") {
                unrecognized.push(key);
                continue;
            }
            const r = _catchall.run({ value: input[key], issues: [] }, ctx);
            if (r instanceof Promise) {
                proms.push(r.then((r) => handleObjectResult(r, payload, key)));
            }
            else {
                handleObjectResult(r, payload, key);
            }
        }
        if (unrecognized.length) {
            payload.issues.push({
                code: "unrecognized_keys",
                keys: unrecognized,
                input,
                inst,
            });
        }
        if (!proms.length)
            return payload;
        return Promise.all(proms).then(() => {
            return payload;
        });
    };
});
function handleUnionResults(results, final, inst, ctx) {
    for (const result of results) {
        if (result.issues.length === 0) {
            final.value = result.value;
            return final;
        }
    }
    final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
    });
    return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
            return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
            const patterns = def.options.map((o) => o._zod.pattern);
            return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
        }
        return undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        let async = false;
        const results = [];
        for (const option of def.options) {
            const result = option._zod.run({
                value: payload.value,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                results.push(result);
                async = true;
            }
            else {
                if (result.issues.length === 0)
                    return result;
                results.push(result);
            }
        }
        if (!async)
            return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results) => {
            return handleUnionResults(results, payload, inst, ctx);
        });
    };
});
const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.values = new Set(def.values);
    inst._zod.pattern = new RegExp(`^(${def.values
        .map((o) => (typeof o === "string" ? escapeRegex(o) : o ? o.toString() : String(o)))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (inst._zod.values.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values: def.values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
            return def.innerType._zod.run(payload, ctx);
        }
        if (payload.value === undefined) {
            return payload;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodLazy = /*@__PURE__*/ $constructor("$ZodLazy", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "innerType", () => def.getter());
    defineLazy(inst._zod, "pattern", () => inst._zod.innerType._zod.pattern);
    defineLazy(inst._zod, "propValues", () => inst._zod.innerType._zod.propValues);
    defineLazy(inst._zod, "optin", () => inst._zod.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => inst._zod.innerType._zod.optout);
    inst._zod.parse = (payload, ctx) => {
        const inner = inst._zod.innerType;
        return inner._zod.run(payload, ctx);
    };
});

function _string(Class, params) {
    return new Class({
        type: "string",
        ...normalizeParams(),
    });
}
function _number(Class, params) {
    return new Class({
        type: "number",
        checks: [],
        ...normalizeParams(),
    });
}
function _boolean(Class, params) {
    return new Class({
        type: "boolean",
        ...normalizeParams(),
    });
}

const ZodMiniType = /*@__PURE__*/ $constructor("ZodMiniType", (inst, def) => {
    if (!inst._zod)
        throw new Error("Uninitialized schema in ZodMiniType.");
    $ZodType.init(inst, def);
    inst.def = def;
    inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => safeParse(inst, data, params);
    inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
    inst.check = (...checks) => {
        return inst.clone({
            ...def,
            checks: [
                ...(def.checks ?? []),
                ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch),
            ],
        }
        // { parent: true }
        );
    };
    inst.clone = (_def, params) => clone(inst, _def, params);
    inst.brand = () => inst;
    inst.register = ((reg, meta) => {
        reg.add(inst, meta);
        return inst;
    });
});
const ZodMiniString = /*@__PURE__*/ $constructor("ZodMiniString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodMiniType.init(inst, def);
});
function string(params) {
    return _string(ZodMiniString);
}
const ZodMiniNumber = /*@__PURE__*/ $constructor("ZodMiniNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodMiniType.init(inst, def);
});
function number(params) {
    return _number(ZodMiniNumber);
}
const ZodMiniBoolean = /*@__PURE__*/ $constructor("ZodMiniBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodMiniType.init(inst, def);
});
function boolean(params) {
    return _boolean(ZodMiniBoolean);
}
const ZodMiniArray = /*@__PURE__*/ $constructor("ZodMiniArray", (inst, def) => {
    $ZodArray.init(inst, def);
    ZodMiniType.init(inst, def);
});
function array(element, params) {
    return new ZodMiniArray({
        type: "array",
        element: element,
        ...normalizeParams(),
    });
}
const ZodMiniObject = /*@__PURE__*/ $constructor("ZodMiniObject", (inst, def) => {
    $ZodObject.init(inst, def);
    ZodMiniType.init(inst, def);
    defineLazy(inst, "shape", () => def.shape);
});
function object(shape, params) {
    const def = {
        type: "object",
        get shape() {
            assignProp(this, "shape", { ...shape });
            return this.shape;
        },
        ...normalizeParams(),
    };
    return new ZodMiniObject(def);
}
const ZodMiniUnion = /*@__PURE__*/ $constructor("ZodMiniUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodMiniType.init(inst, def);
});
function union(options, params) {
    return new ZodMiniUnion({
        type: "union",
        options: options,
        ...normalizeParams(),
    });
}
const ZodMiniLiteral = /*@__PURE__*/ $constructor("ZodMiniLiteral", (inst, def) => {
    $ZodLiteral.init(inst, def);
    ZodMiniType.init(inst, def);
});
function literal(value, params) {
    return new ZodMiniLiteral({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ...normalizeParams(),
    });
}
const ZodMiniOptional = /*@__PURE__*/ $constructor("ZodMiniOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodMiniType.init(inst, def);
});
function optional(innerType) {
    return new ZodMiniOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodMiniLazy = /*@__PURE__*/ $constructor("ZodMiniLazy", (inst, def) => {
    $ZodLazy.init(inst, def);
    ZodMiniType.init(inst, def);
});
// export function lazy<T extends object>(getter: () => T): T {
//   return util.createTransparentProxy<T>(getter);
// }
function _lazy(getter) {
    return new ZodMiniLazy({
        type: "lazy",
        getter: getter,
    });
}

/**
 * Serializable structure that represents an option.
 */
const Option = object({
    type: literal("option"),
    disabled: optional(boolean()),
    label: string(),
    value: union([boolean(), number(), string()]),
});

/**
 * Serializable structure that represents a group of options.
 */
const OptionGroup = object({
    type: literal("option-group"),
    disabled: optional(boolean()),
    options: _lazy(() => array(union([Option, OptionGroup]))),
    label: string(),
});

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var bufferUtil = {exports: {}};

var constants;
var hasRequiredConstants;

function requireConstants () {
	if (hasRequiredConstants) return constants;
	hasRequiredConstants = 1;

	const BINARY_TYPES = ['nodebuffer', 'arraybuffer', 'fragments'];
	const hasBlob = typeof Blob !== 'undefined';

	if (hasBlob) BINARY_TYPES.push('blob');

	constants = {
	  BINARY_TYPES,
	  CLOSE_TIMEOUT: 30000,
	  EMPTY_BUFFER: Buffer.alloc(0),
	  GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
	  hasBlob,
	  kForOnEventAttribute: Symbol('kIsForOnEventAttribute'),
	  kListener: Symbol('kListener'),
	  kStatusCode: Symbol('status-code'),
	  kWebSocket: Symbol('websocket'),
	  NOOP: () => {}
	};
	return constants;
}

var hasRequiredBufferUtil;

function requireBufferUtil () {
	if (hasRequiredBufferUtil) return bufferUtil.exports;
	hasRequiredBufferUtil = 1;

	const { EMPTY_BUFFER } = requireConstants();

	const FastBuffer = Buffer[Symbol.species];

	/**
	 * Merges an array of buffers into a new buffer.
	 *
	 * @param {Buffer[]} list The array of buffers to concat
	 * @param {Number} totalLength The total length of buffers in the list
	 * @return {Buffer} The resulting buffer
	 * @public
	 */
	function concat(list, totalLength) {
	  if (list.length === 0) return EMPTY_BUFFER;
	  if (list.length === 1) return list[0];

	  const target = Buffer.allocUnsafe(totalLength);
	  let offset = 0;

	  for (let i = 0; i < list.length; i++) {
	    const buf = list[i];
	    target.set(buf, offset);
	    offset += buf.length;
	  }

	  if (offset < totalLength) {
	    return new FastBuffer(target.buffer, target.byteOffset, offset);
	  }

	  return target;
	}

	/**
	 * Masks a buffer using the given mask.
	 *
	 * @param {Buffer} source The buffer to mask
	 * @param {Buffer} mask The mask to use
	 * @param {Buffer} output The buffer where to store the result
	 * @param {Number} offset The offset at which to start writing
	 * @param {Number} length The number of bytes to mask.
	 * @public
	 */
	function _mask(source, mask, output, offset, length) {
	  for (let i = 0; i < length; i++) {
	    output[offset + i] = source[i] ^ mask[i & 3];
	  }
	}

	/**
	 * Unmasks a buffer using the given mask.
	 *
	 * @param {Buffer} buffer The buffer to unmask
	 * @param {Buffer} mask The mask to use
	 * @public
	 */
	function _unmask(buffer, mask) {
	  for (let i = 0; i < buffer.length; i++) {
	    buffer[i] ^= mask[i & 3];
	  }
	}

	/**
	 * Converts a buffer to an `ArrayBuffer`.
	 *
	 * @param {Buffer} buf The buffer to convert
	 * @return {ArrayBuffer} Converted buffer
	 * @public
	 */
	function toArrayBuffer(buf) {
	  if (buf.length === buf.buffer.byteLength) {
	    return buf.buffer;
	  }

	  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
	}

	/**
	 * Converts `data` to a `Buffer`.
	 *
	 * @param {*} data The data to convert
	 * @return {Buffer} The buffer
	 * @throws {TypeError}
	 * @public
	 */
	function toBuffer(data) {
	  toBuffer.readOnly = true;

	  if (Buffer.isBuffer(data)) return data;

	  let buf;

	  if (data instanceof ArrayBuffer) {
	    buf = new FastBuffer(data);
	  } else if (ArrayBuffer.isView(data)) {
	    buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
	  } else {
	    buf = Buffer.from(data);
	    toBuffer.readOnly = false;
	  }

	  return buf;
	}

	bufferUtil.exports = {
	  concat,
	  mask: _mask,
	  toArrayBuffer,
	  toBuffer,
	  unmask: _unmask
	};

	/* istanbul ignore else  */
	if (!process.env.WS_NO_BUFFER_UTIL) {
	  try {
	    const bufferUtil$1 = require('bufferutil');

	    bufferUtil.exports.mask = function (source, mask, output, offset, length) {
	      if (length < 48) _mask(source, mask, output, offset, length);
	      else bufferUtil$1.mask(source, mask, output, offset, length);
	    };

	    bufferUtil.exports.unmask = function (buffer, mask) {
	      if (buffer.length < 32) _unmask(buffer, mask);
	      else bufferUtil$1.unmask(buffer, mask);
	    };
	  } catch (e) {
	    // Continue regardless of the error.
	  }
	}
	return bufferUtil.exports;
}

var limiter;
var hasRequiredLimiter;

function requireLimiter () {
	if (hasRequiredLimiter) return limiter;
	hasRequiredLimiter = 1;

	const kDone = Symbol('kDone');
	const kRun = Symbol('kRun');

	/**
	 * A very simple job queue with adjustable concurrency. Adapted from
	 * https://github.com/STRML/async-limiter
	 */
	class Limiter {
	  /**
	   * Creates a new `Limiter`.
	   *
	   * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
	   *     to run concurrently
	   */
	  constructor(concurrency) {
	    this[kDone] = () => {
	      this.pending--;
	      this[kRun]();
	    };
	    this.concurrency = concurrency || Infinity;
	    this.jobs = [];
	    this.pending = 0;
	  }

	  /**
	   * Adds a job to the queue.
	   *
	   * @param {Function} job The job to run
	   * @public
	   */
	  add(job) {
	    this.jobs.push(job);
	    this[kRun]();
	  }

	  /**
	   * Removes a job from the queue and runs it if possible.
	   *
	   * @private
	   */
	  [kRun]() {
	    if (this.pending === this.concurrency) return;

	    if (this.jobs.length) {
	      const job = this.jobs.shift();

	      this.pending++;
	      job(this[kDone]);
	    }
	  }
	}

	limiter = Limiter;
	return limiter;
}

var permessageDeflate;
var hasRequiredPermessageDeflate;

function requirePermessageDeflate () {
	if (hasRequiredPermessageDeflate) return permessageDeflate;
	hasRequiredPermessageDeflate = 1;

	const zlib = require$$0;

	const bufferUtil = requireBufferUtil();
	const Limiter = requireLimiter();
	const { kStatusCode } = requireConstants();

	const FastBuffer = Buffer[Symbol.species];
	const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);
	const kPerMessageDeflate = Symbol('permessage-deflate');
	const kTotalLength = Symbol('total-length');
	const kCallback = Symbol('callback');
	const kBuffers = Symbol('buffers');
	const kError = Symbol('error');

	//
	// We limit zlib concurrency, which prevents severe memory fragmentation
	// as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
	// and https://github.com/websockets/ws/issues/1202
	//
	// Intentionally global; it's the global thread pool that's an issue.
	//
	let zlibLimiter;

	/**
	 * permessage-deflate implementation.
	 */
	class PerMessageDeflate {
	  /**
	   * Creates a PerMessageDeflate instance.
	   *
	   * @param {Object} [options] Configuration options
	   * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
	   *     for, or request, a custom client window size
	   * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
	   *     acknowledge disabling of client context takeover
	   * @param {Number} [options.concurrencyLimit=10] The number of concurrent
	   *     calls to zlib
	   * @param {Boolean} [options.isServer=false] Create the instance in either
	   *     server or client mode
	   * @param {Number} [options.maxPayload=0] The maximum allowed message length
	   * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
	   *     use of a custom server window size
	   * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
	   *     disabling of server context takeover
	   * @param {Number} [options.threshold=1024] Size (in bytes) below which
	   *     messages should not be compressed if context takeover is disabled
	   * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
	   *     deflate
	   * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
	   *     inflate
	   */
	  constructor(options) {
	    this._options = options || {};
	    this._threshold =
	      this._options.threshold !== undefined ? this._options.threshold : 1024;
	    this._maxPayload = this._options.maxPayload | 0;
	    this._isServer = !!this._options.isServer;
	    this._deflate = null;
	    this._inflate = null;

	    this.params = null;

	    if (!zlibLimiter) {
	      const concurrency =
	        this._options.concurrencyLimit !== undefined
	          ? this._options.concurrencyLimit
	          : 10;
	      zlibLimiter = new Limiter(concurrency);
	    }
	  }

	  /**
	   * @type {String}
	   */
	  static get extensionName() {
	    return 'permessage-deflate';
	  }

	  /**
	   * Create an extension negotiation offer.
	   *
	   * @return {Object} Extension parameters
	   * @public
	   */
	  offer() {
	    const params = {};

	    if (this._options.serverNoContextTakeover) {
	      params.server_no_context_takeover = true;
	    }
	    if (this._options.clientNoContextTakeover) {
	      params.client_no_context_takeover = true;
	    }
	    if (this._options.serverMaxWindowBits) {
	      params.server_max_window_bits = this._options.serverMaxWindowBits;
	    }
	    if (this._options.clientMaxWindowBits) {
	      params.client_max_window_bits = this._options.clientMaxWindowBits;
	    } else if (this._options.clientMaxWindowBits == null) {
	      params.client_max_window_bits = true;
	    }

	    return params;
	  }

	  /**
	   * Accept an extension negotiation offer/response.
	   *
	   * @param {Array} configurations The extension negotiation offers/reponse
	   * @return {Object} Accepted configuration
	   * @public
	   */
	  accept(configurations) {
	    configurations = this.normalizeParams(configurations);

	    this.params = this._isServer
	      ? this.acceptAsServer(configurations)
	      : this.acceptAsClient(configurations);

	    return this.params;
	  }

	  /**
	   * Releases all resources used by the extension.
	   *
	   * @public
	   */
	  cleanup() {
	    if (this._inflate) {
	      this._inflate.close();
	      this._inflate = null;
	    }

	    if (this._deflate) {
	      const callback = this._deflate[kCallback];

	      this._deflate.close();
	      this._deflate = null;

	      if (callback) {
	        callback(
	          new Error(
	            'The deflate stream was closed while data was being processed'
	          )
	        );
	      }
	    }
	  }

	  /**
	   *  Accept an extension negotiation offer.
	   *
	   * @param {Array} offers The extension negotiation offers
	   * @return {Object} Accepted configuration
	   * @private
	   */
	  acceptAsServer(offers) {
	    const opts = this._options;
	    const accepted = offers.find((params) => {
	      if (
	        (opts.serverNoContextTakeover === false &&
	          params.server_no_context_takeover) ||
	        (params.server_max_window_bits &&
	          (opts.serverMaxWindowBits === false ||
	            (typeof opts.serverMaxWindowBits === 'number' &&
	              opts.serverMaxWindowBits > params.server_max_window_bits))) ||
	        (typeof opts.clientMaxWindowBits === 'number' &&
	          (typeof params.client_max_window_bits === 'number'
	            ? opts.clientMaxWindowBits > params.client_max_window_bits
	            : !params.client_max_window_bits))
	      ) {
	        return false;
	      }

	      return true;
	    });

	    if (!accepted) {
	      throw new Error('None of the extension offers can be accepted');
	    }

	    if (opts.serverNoContextTakeover) {
	      accepted.server_no_context_takeover = true;
	    }
	    if (opts.clientNoContextTakeover) {
	      accepted.client_no_context_takeover = true;
	    }
	    if (typeof opts.serverMaxWindowBits === 'number') {
	      accepted.server_max_window_bits = opts.serverMaxWindowBits;
	    }
	    if (typeof opts.clientMaxWindowBits === 'number') {
	      accepted.client_max_window_bits = opts.clientMaxWindowBits;
	    } else if (
	      accepted.client_max_window_bits === true ||
	      opts.clientMaxWindowBits === false
	    ) {
	      delete accepted.client_max_window_bits;
	    }

	    return accepted;
	  }

	  /**
	   * Accept the extension negotiation response.
	   *
	   * @param {Array} response The extension negotiation response
	   * @return {Object} Accepted configuration
	   * @private
	   */
	  acceptAsClient(response) {
	    const params = response[0];

	    if (
	      this._options.clientNoContextTakeover === false &&
	      params.client_no_context_takeover
	    ) {
	      throw new Error('Unexpected parameter "client_no_context_takeover"');
	    }

	    if (!params.client_max_window_bits) {
	      if (typeof this._options.clientMaxWindowBits === 'number') {
	        params.client_max_window_bits = this._options.clientMaxWindowBits;
	      }
	    } else if (
	      this._options.clientMaxWindowBits === false ||
	      (typeof this._options.clientMaxWindowBits === 'number' &&
	        params.client_max_window_bits > this._options.clientMaxWindowBits)
	    ) {
	      throw new Error(
	        'Unexpected or invalid parameter "client_max_window_bits"'
	      );
	    }

	    return params;
	  }

	  /**
	   * Normalize parameters.
	   *
	   * @param {Array} configurations The extension negotiation offers/reponse
	   * @return {Array} The offers/response with normalized parameters
	   * @private
	   */
	  normalizeParams(configurations) {
	    configurations.forEach((params) => {
	      Object.keys(params).forEach((key) => {
	        let value = params[key];

	        if (value.length > 1) {
	          throw new Error(`Parameter "${key}" must have only a single value`);
	        }

	        value = value[0];

	        if (key === 'client_max_window_bits') {
	          if (value !== true) {
	            const num = +value;
	            if (!Number.isInteger(num) || num < 8 || num > 15) {
	              throw new TypeError(
	                `Invalid value for parameter "${key}": ${value}`
	              );
	            }
	            value = num;
	          } else if (!this._isServer) {
	            throw new TypeError(
	              `Invalid value for parameter "${key}": ${value}`
	            );
	          }
	        } else if (key === 'server_max_window_bits') {
	          const num = +value;
	          if (!Number.isInteger(num) || num < 8 || num > 15) {
	            throw new TypeError(
	              `Invalid value for parameter "${key}": ${value}`
	            );
	          }
	          value = num;
	        } else if (
	          key === 'client_no_context_takeover' ||
	          key === 'server_no_context_takeover'
	        ) {
	          if (value !== true) {
	            throw new TypeError(
	              `Invalid value for parameter "${key}": ${value}`
	            );
	          }
	        } else {
	          throw new Error(`Unknown parameter "${key}"`);
	        }

	        params[key] = value;
	      });
	    });

	    return configurations;
	  }

	  /**
	   * Decompress data. Concurrency limited.
	   *
	   * @param {Buffer} data Compressed data
	   * @param {Boolean} fin Specifies whether or not this is the last fragment
	   * @param {Function} callback Callback
	   * @public
	   */
	  decompress(data, fin, callback) {
	    zlibLimiter.add((done) => {
	      this._decompress(data, fin, (err, result) => {
	        done();
	        callback(err, result);
	      });
	    });
	  }

	  /**
	   * Compress data. Concurrency limited.
	   *
	   * @param {(Buffer|String)} data Data to compress
	   * @param {Boolean} fin Specifies whether or not this is the last fragment
	   * @param {Function} callback Callback
	   * @public
	   */
	  compress(data, fin, callback) {
	    zlibLimiter.add((done) => {
	      this._compress(data, fin, (err, result) => {
	        done();
	        callback(err, result);
	      });
	    });
	  }

	  /**
	   * Decompress data.
	   *
	   * @param {Buffer} data Compressed data
	   * @param {Boolean} fin Specifies whether or not this is the last fragment
	   * @param {Function} callback Callback
	   * @private
	   */
	  _decompress(data, fin, callback) {
	    const endpoint = this._isServer ? 'client' : 'server';

	    if (!this._inflate) {
	      const key = `${endpoint}_max_window_bits`;
	      const windowBits =
	        typeof this.params[key] !== 'number'
	          ? zlib.Z_DEFAULT_WINDOWBITS
	          : this.params[key];

	      this._inflate = zlib.createInflateRaw({
	        ...this._options.zlibInflateOptions,
	        windowBits
	      });
	      this._inflate[kPerMessageDeflate] = this;
	      this._inflate[kTotalLength] = 0;
	      this._inflate[kBuffers] = [];
	      this._inflate.on('error', inflateOnError);
	      this._inflate.on('data', inflateOnData);
	    }

	    this._inflate[kCallback] = callback;

	    this._inflate.write(data);
	    if (fin) this._inflate.write(TRAILER);

	    this._inflate.flush(() => {
	      const err = this._inflate[kError];

	      if (err) {
	        this._inflate.close();
	        this._inflate = null;
	        callback(err);
	        return;
	      }

	      const data = bufferUtil.concat(
	        this._inflate[kBuffers],
	        this._inflate[kTotalLength]
	      );

	      if (this._inflate._readableState.endEmitted) {
	        this._inflate.close();
	        this._inflate = null;
	      } else {
	        this._inflate[kTotalLength] = 0;
	        this._inflate[kBuffers] = [];

	        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
	          this._inflate.reset();
	        }
	      }

	      callback(null, data);
	    });
	  }

	  /**
	   * Compress data.
	   *
	   * @param {(Buffer|String)} data Data to compress
	   * @param {Boolean} fin Specifies whether or not this is the last fragment
	   * @param {Function} callback Callback
	   * @private
	   */
	  _compress(data, fin, callback) {
	    const endpoint = this._isServer ? 'server' : 'client';

	    if (!this._deflate) {
	      const key = `${endpoint}_max_window_bits`;
	      const windowBits =
	        typeof this.params[key] !== 'number'
	          ? zlib.Z_DEFAULT_WINDOWBITS
	          : this.params[key];

	      this._deflate = zlib.createDeflateRaw({
	        ...this._options.zlibDeflateOptions,
	        windowBits
	      });

	      this._deflate[kTotalLength] = 0;
	      this._deflate[kBuffers] = [];

	      this._deflate.on('data', deflateOnData);
	    }

	    this._deflate[kCallback] = callback;

	    this._deflate.write(data);
	    this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
	      if (!this._deflate) {
	        //
	        // The deflate stream was closed while data was being processed.
	        //
	        return;
	      }

	      let data = bufferUtil.concat(
	        this._deflate[kBuffers],
	        this._deflate[kTotalLength]
	      );

	      if (fin) {
	        data = new FastBuffer(data.buffer, data.byteOffset, data.length - 4);
	      }

	      //
	      // Ensure that the callback will not be called again in
	      // `PerMessageDeflate#cleanup()`.
	      //
	      this._deflate[kCallback] = null;

	      this._deflate[kTotalLength] = 0;
	      this._deflate[kBuffers] = [];

	      if (fin && this.params[`${endpoint}_no_context_takeover`]) {
	        this._deflate.reset();
	      }

	      callback(null, data);
	    });
	  }
	}

	permessageDeflate = PerMessageDeflate;

	/**
	 * The listener of the `zlib.DeflateRaw` stream `'data'` event.
	 *
	 * @param {Buffer} chunk A chunk of data
	 * @private
	 */
	function deflateOnData(chunk) {
	  this[kBuffers].push(chunk);
	  this[kTotalLength] += chunk.length;
	}

	/**
	 * The listener of the `zlib.InflateRaw` stream `'data'` event.
	 *
	 * @param {Buffer} chunk A chunk of data
	 * @private
	 */
	function inflateOnData(chunk) {
	  this[kTotalLength] += chunk.length;

	  if (
	    this[kPerMessageDeflate]._maxPayload < 1 ||
	    this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
	  ) {
	    this[kBuffers].push(chunk);
	    return;
	  }

	  this[kError] = new RangeError('Max payload size exceeded');
	  this[kError].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
	  this[kError][kStatusCode] = 1009;
	  this.removeListener('data', inflateOnData);

	  //
	  // The choice to employ `zlib.reset()` over `zlib.close()` is dictated by the
	  // fact that in Node.js versions prior to 13.10.0, the callback for
	  // `zlib.flush()` is not called if `zlib.close()` is used. Utilizing
	  // `zlib.reset()` ensures that either the callback is invoked or an error is
	  // emitted.
	  //
	  this.reset();
	}

	/**
	 * The listener of the `zlib.InflateRaw` stream `'error'` event.
	 *
	 * @param {Error} err The emitted error
	 * @private
	 */
	function inflateOnError(err) {
	  //
	  // There is no need to call `Zlib#close()` as the handle is automatically
	  // closed when an error is emitted.
	  //
	  this[kPerMessageDeflate]._inflate = null;

	  if (this[kError]) {
	    this[kCallback](this[kError]);
	    return;
	  }

	  err[kStatusCode] = 1007;
	  this[kCallback](err);
	}
	return permessageDeflate;
}

var validation = {exports: {}};

var hasRequiredValidation;

function requireValidation () {
	if (hasRequiredValidation) return validation.exports;
	hasRequiredValidation = 1;

	const { isUtf8 } = require$$0$1;

	const { hasBlob } = requireConstants();

	//
	// Allowed token characters:
	//
	// '!', '#', '$', '%', '&', ''', '*', '+', '-',
	// '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
	//
	// tokenChars[32] === 0 // ' '
	// tokenChars[33] === 1 // '!'
	// tokenChars[34] === 0 // '"'
	// ...
	//
	// prettier-ignore
	const tokenChars = [
	  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
	  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
	  0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
	  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
	  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
	  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
	  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
	  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
	];

	/**
	 * Checks if a status code is allowed in a close frame.
	 *
	 * @param {Number} code The status code
	 * @return {Boolean} `true` if the status code is valid, else `false`
	 * @public
	 */
	function isValidStatusCode(code) {
	  return (
	    (code >= 1000 &&
	      code <= 1014 &&
	      code !== 1004 &&
	      code !== 1005 &&
	      code !== 1006) ||
	    (code >= 3000 && code <= 4999)
	  );
	}

	/**
	 * Checks if a given buffer contains only correct UTF-8.
	 * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
	 * Markus Kuhn.
	 *
	 * @param {Buffer} buf The buffer to check
	 * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
	 * @public
	 */
	function _isValidUTF8(buf) {
	  const len = buf.length;
	  let i = 0;

	  while (i < len) {
	    if ((buf[i] & 0x80) === 0) {
	      // 0xxxxxxx
	      i++;
	    } else if ((buf[i] & 0xe0) === 0xc0) {
	      // 110xxxxx 10xxxxxx
	      if (
	        i + 1 === len ||
	        (buf[i + 1] & 0xc0) !== 0x80 ||
	        (buf[i] & 0xfe) === 0xc0 // Overlong
	      ) {
	        return false;
	      }

	      i += 2;
	    } else if ((buf[i] & 0xf0) === 0xe0) {
	      // 1110xxxx 10xxxxxx 10xxxxxx
	      if (
	        i + 2 >= len ||
	        (buf[i + 1] & 0xc0) !== 0x80 ||
	        (buf[i + 2] & 0xc0) !== 0x80 ||
	        (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
	        (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
	      ) {
	        return false;
	      }

	      i += 3;
	    } else if ((buf[i] & 0xf8) === 0xf0) {
	      // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
	      if (
	        i + 3 >= len ||
	        (buf[i + 1] & 0xc0) !== 0x80 ||
	        (buf[i + 2] & 0xc0) !== 0x80 ||
	        (buf[i + 3] & 0xc0) !== 0x80 ||
	        (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
	        (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
	        buf[i] > 0xf4 // > U+10FFFF
	      ) {
	        return false;
	      }

	      i += 4;
	    } else {
	      return false;
	    }
	  }

	  return true;
	}

	/**
	 * Determines whether a value is a `Blob`.
	 *
	 * @param {*} value The value to be tested
	 * @return {Boolean} `true` if `value` is a `Blob`, else `false`
	 * @private
	 */
	function isBlob(value) {
	  return (
	    hasBlob &&
	    typeof value === 'object' &&
	    typeof value.arrayBuffer === 'function' &&
	    typeof value.type === 'string' &&
	    typeof value.stream === 'function' &&
	    (value[Symbol.toStringTag] === 'Blob' ||
	      value[Symbol.toStringTag] === 'File')
	  );
	}

	validation.exports = {
	  isBlob,
	  isValidStatusCode,
	  isValidUTF8: _isValidUTF8,
	  tokenChars
	};

	if (isUtf8) {
	  validation.exports.isValidUTF8 = function (buf) {
	    return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
	  };
	} /* istanbul ignore else  */ else if (!process.env.WS_NO_UTF_8_VALIDATE) {
	  try {
	    const isValidUTF8 = require('utf-8-validate');

	    validation.exports.isValidUTF8 = function (buf) {
	      return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
	    };
	  } catch (e) {
	    // Continue regardless of the error.
	  }
	}
	return validation.exports;
}

var receiver;
var hasRequiredReceiver;

function requireReceiver () {
	if (hasRequiredReceiver) return receiver;
	hasRequiredReceiver = 1;

	const { Writable } = require$$0$2;

	const PerMessageDeflate = requirePermessageDeflate();
	const {
	  BINARY_TYPES,
	  EMPTY_BUFFER,
	  kStatusCode,
	  kWebSocket
	} = requireConstants();
	const { concat, toArrayBuffer, unmask } = requireBufferUtil();
	const { isValidStatusCode, isValidUTF8 } = requireValidation();

	const FastBuffer = Buffer[Symbol.species];

	const GET_INFO = 0;
	const GET_PAYLOAD_LENGTH_16 = 1;
	const GET_PAYLOAD_LENGTH_64 = 2;
	const GET_MASK = 3;
	const GET_DATA = 4;
	const INFLATING = 5;
	const DEFER_EVENT = 6;

	/**
	 * HyBi Receiver implementation.
	 *
	 * @extends Writable
	 */
	class Receiver extends Writable {
	  /**
	   * Creates a Receiver instance.
	   *
	   * @param {Object} [options] Options object
	   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
	   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
	   *     multiple times in the same tick
	   * @param {String} [options.binaryType=nodebuffer] The type for binary data
	   * @param {Object} [options.extensions] An object containing the negotiated
	   *     extensions
	   * @param {Boolean} [options.isServer=false] Specifies whether to operate in
	   *     client or server mode
	   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
	   *     buffered data chunks
	   * @param {Number} [options.maxFragments=0] The maximum number of message
	   *     fragments
	   * @param {Number} [options.maxPayload=0] The maximum allowed message length
	   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
	   *     not to skip UTF-8 validation for text and close messages
	   */
	  constructor(options = {}) {
	    super();

	    this._allowSynchronousEvents =
	      options.allowSynchronousEvents !== undefined
	        ? options.allowSynchronousEvents
	        : true;
	    this._binaryType = options.binaryType || BINARY_TYPES[0];
	    this._extensions = options.extensions || {};
	    this._isServer = !!options.isServer;
	    this._maxBufferedChunks = options.maxBufferedChunks | 0;
	    this._maxFragments = options.maxFragments | 0;
	    this._maxPayload = options.maxPayload | 0;
	    this._skipUTF8Validation = !!options.skipUTF8Validation;
	    this[kWebSocket] = undefined;

	    this._bufferedBytes = 0;
	    this._buffers = [];

	    this._compressed = false;
	    this._payloadLength = 0;
	    this._mask = undefined;
	    this._fragmented = 0;
	    this._masked = false;
	    this._fin = false;
	    this._opcode = 0;

	    this._totalPayloadLength = 0;
	    this._messageLength = 0;
	    this._numFragments = 0;
	    this._fragments = [];

	    this._errored = false;
	    this._loop = false;
	    this._state = GET_INFO;
	  }

	  /**
	   * Implements `Writable.prototype._write()`.
	   *
	   * @param {Buffer} chunk The chunk of data to write
	   * @param {String} encoding The character encoding of `chunk`
	   * @param {Function} cb Callback
	   * @private
	   */
	  _write(chunk, encoding, cb) {
	    if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

	    if (
	      this._maxBufferedChunks > 0 &&
	      this._buffers.length >= this._maxBufferedChunks
	    ) {
	      cb(
	        this.createError(
	          RangeError,
	          'Too many buffered chunks',
	          false,
	          1008,
	          'WS_ERR_TOO_MANY_BUFFERED_PARTS'
	        )
	      );
	      return;
	    }

	    this._bufferedBytes += chunk.length;
	    this._buffers.push(chunk);
	    this.startLoop(cb);
	  }

	  /**
	   * Consumes `n` bytes from the buffered data.
	   *
	   * @param {Number} n The number of bytes to consume
	   * @return {Buffer} The consumed bytes
	   * @private
	   */
	  consume(n) {
	    this._bufferedBytes -= n;

	    if (n === this._buffers[0].length) return this._buffers.shift();

	    if (n < this._buffers[0].length) {
	      const buf = this._buffers[0];
	      this._buffers[0] = new FastBuffer(
	        buf.buffer,
	        buf.byteOffset + n,
	        buf.length - n
	      );

	      return new FastBuffer(buf.buffer, buf.byteOffset, n);
	    }

	    const dst = Buffer.allocUnsafe(n);

	    do {
	      const buf = this._buffers[0];
	      const offset = dst.length - n;

	      if (n >= buf.length) {
	        dst.set(this._buffers.shift(), offset);
	      } else {
	        dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
	        this._buffers[0] = new FastBuffer(
	          buf.buffer,
	          buf.byteOffset + n,
	          buf.length - n
	        );
	      }

	      n -= buf.length;
	    } while (n > 0);

	    return dst;
	  }

	  /**
	   * Starts the parsing loop.
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  startLoop(cb) {
	    this._loop = true;

	    do {
	      switch (this._state) {
	        case GET_INFO:
	          this.getInfo(cb);
	          break;
	        case GET_PAYLOAD_LENGTH_16:
	          this.getPayloadLength16(cb);
	          break;
	        case GET_PAYLOAD_LENGTH_64:
	          this.getPayloadLength64(cb);
	          break;
	        case GET_MASK:
	          this.getMask();
	          break;
	        case GET_DATA:
	          this.getData(cb);
	          break;
	        case INFLATING:
	        case DEFER_EVENT:
	          this._loop = false;
	          return;
	      }
	    } while (this._loop);

	    if (!this._errored) cb();
	  }

	  /**
	   * Reads the first two bytes of a frame.
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  getInfo(cb) {
	    if (this._bufferedBytes < 2) {
	      this._loop = false;
	      return;
	    }

	    const buf = this.consume(2);

	    if ((buf[0] & 0x30) !== 0x00) {
	      const error = this.createError(
	        RangeError,
	        'RSV2 and RSV3 must be clear',
	        true,
	        1002,
	        'WS_ERR_UNEXPECTED_RSV_2_3'
	      );

	      cb(error);
	      return;
	    }

	    const compressed = (buf[0] & 0x40) === 0x40;

	    if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
	      const error = this.createError(
	        RangeError,
	        'RSV1 must be clear',
	        true,
	        1002,
	        'WS_ERR_UNEXPECTED_RSV_1'
	      );

	      cb(error);
	      return;
	    }

	    this._fin = (buf[0] & 0x80) === 0x80;
	    this._opcode = buf[0] & 0x0f;
	    this._payloadLength = buf[1] & 0x7f;

	    if (this._opcode === 0x00) {
	      if (compressed) {
	        const error = this.createError(
	          RangeError,
	          'RSV1 must be clear',
	          true,
	          1002,
	          'WS_ERR_UNEXPECTED_RSV_1'
	        );

	        cb(error);
	        return;
	      }

	      if (!this._fragmented) {
	        const error = this.createError(
	          RangeError,
	          'invalid opcode 0',
	          true,
	          1002,
	          'WS_ERR_INVALID_OPCODE'
	        );

	        cb(error);
	        return;
	      }

	      this._opcode = this._fragmented;
	    } else if (this._opcode === 0x01 || this._opcode === 0x02) {
	      if (this._fragmented) {
	        const error = this.createError(
	          RangeError,
	          `invalid opcode ${this._opcode}`,
	          true,
	          1002,
	          'WS_ERR_INVALID_OPCODE'
	        );

	        cb(error);
	        return;
	      }

	      this._compressed = compressed;
	    } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
	      if (!this._fin) {
	        const error = this.createError(
	          RangeError,
	          'FIN must be set',
	          true,
	          1002,
	          'WS_ERR_EXPECTED_FIN'
	        );

	        cb(error);
	        return;
	      }

	      if (compressed) {
	        const error = this.createError(
	          RangeError,
	          'RSV1 must be clear',
	          true,
	          1002,
	          'WS_ERR_UNEXPECTED_RSV_1'
	        );

	        cb(error);
	        return;
	      }

	      if (
	        this._payloadLength > 0x7d ||
	        (this._opcode === 0x08 && this._payloadLength === 1)
	      ) {
	        const error = this.createError(
	          RangeError,
	          `invalid payload length ${this._payloadLength}`,
	          true,
	          1002,
	          'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
	        );

	        cb(error);
	        return;
	      }
	    } else {
	      const error = this.createError(
	        RangeError,
	        `invalid opcode ${this._opcode}`,
	        true,
	        1002,
	        'WS_ERR_INVALID_OPCODE'
	      );

	      cb(error);
	      return;
	    }

	    if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
	    this._masked = (buf[1] & 0x80) === 0x80;

	    if (this._isServer) {
	      if (!this._masked) {
	        const error = this.createError(
	          RangeError,
	          'MASK must be set',
	          true,
	          1002,
	          'WS_ERR_EXPECTED_MASK'
	        );

	        cb(error);
	        return;
	      }
	    } else if (this._masked) {
	      const error = this.createError(
	        RangeError,
	        'MASK must be clear',
	        true,
	        1002,
	        'WS_ERR_UNEXPECTED_MASK'
	      );

	      cb(error);
	      return;
	    }

	    if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
	    else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
	    else this.haveLength(cb);
	  }

	  /**
	   * Gets extended payload length (7+16).
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  getPayloadLength16(cb) {
	    if (this._bufferedBytes < 2) {
	      this._loop = false;
	      return;
	    }

	    this._payloadLength = this.consume(2).readUInt16BE(0);
	    this.haveLength(cb);
	  }

	  /**
	   * Gets extended payload length (7+64).
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  getPayloadLength64(cb) {
	    if (this._bufferedBytes < 8) {
	      this._loop = false;
	      return;
	    }

	    const buf = this.consume(8);
	    const num = buf.readUInt32BE(0);

	    //
	    // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
	    // if payload length is greater than this number.
	    //
	    if (num > Math.pow(2, 53 - 32) - 1) {
	      const error = this.createError(
	        RangeError,
	        'Unsupported WebSocket frame: payload length > 2^53 - 1',
	        false,
	        1009,
	        'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
	      );

	      cb(error);
	      return;
	    }

	    this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
	    this.haveLength(cb);
	  }

	  /**
	   * Payload length has been read.
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  haveLength(cb) {
	    if (this._payloadLength && this._opcode < 0x08) {
	      this._totalPayloadLength += this._payloadLength;
	      if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
	        const error = this.createError(
	          RangeError,
	          'Max payload size exceeded',
	          false,
	          1009,
	          'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
	        );

	        cb(error);
	        return;
	      }
	    }

	    if (this._masked) this._state = GET_MASK;
	    else this._state = GET_DATA;
	  }

	  /**
	   * Reads mask bytes.
	   *
	   * @private
	   */
	  getMask() {
	    if (this._bufferedBytes < 4) {
	      this._loop = false;
	      return;
	    }

	    this._mask = this.consume(4);
	    this._state = GET_DATA;
	  }

	  /**
	   * Reads data bytes.
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  getData(cb) {
	    let data = EMPTY_BUFFER;

	    if (this._payloadLength) {
	      if (this._bufferedBytes < this._payloadLength) {
	        this._loop = false;
	        return;
	      }

	      data = this.consume(this._payloadLength);

	      if (
	        this._masked &&
	        (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0
	      ) {
	        unmask(data, this._mask);
	      }
	    }

	    if (this._opcode > 0x07) {
	      this.controlMessage(data, cb);
	      return;
	    }

	    if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
	      const error = this.createError(
	        RangeError,
	        'Too many message fragments',
	        false,
	        1008,
	        'WS_ERR_TOO_MANY_BUFFERED_PARTS'
	      );

	      cb(error);
	      return;
	    }

	    if (this._compressed) {
	      this._state = INFLATING;
	      this.decompress(data, cb);
	      return;
	    }

	    if (data.length) {
	      //
	      // This message is not compressed so its length is the sum of the payload
	      // length of all fragments.
	      //
	      this._messageLength = this._totalPayloadLength;
	      this._fragments.push(data);
	    }

	    this.dataMessage(cb);
	  }

	  /**
	   * Decompresses data.
	   *
	   * @param {Buffer} data Compressed data
	   * @param {Function} cb Callback
	   * @private
	   */
	  decompress(data, cb) {
	    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

	    perMessageDeflate.decompress(data, this._fin, (err, buf) => {
	      if (err) return cb(err);

	      if (buf.length) {
	        this._messageLength += buf.length;
	        if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
	          const error = this.createError(
	            RangeError,
	            'Max payload size exceeded',
	            false,
	            1009,
	            'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
	          );

	          cb(error);
	          return;
	        }

	        this._fragments.push(buf);
	      }

	      this.dataMessage(cb);
	      if (this._state === GET_INFO) this.startLoop(cb);
	    });
	  }

	  /**
	   * Handles a data message.
	   *
	   * @param {Function} cb Callback
	   * @private
	   */
	  dataMessage(cb) {
	    if (!this._fin) {
	      this._state = GET_INFO;
	      return;
	    }

	    const messageLength = this._messageLength;
	    const fragments = this._fragments;

	    this._totalPayloadLength = 0;
	    this._messageLength = 0;
	    this._fragmented = 0;
	    this._numFragments = 0;
	    this._fragments = [];

	    if (this._opcode === 2) {
	      let data;

	      if (this._binaryType === 'nodebuffer') {
	        data = concat(fragments, messageLength);
	      } else if (this._binaryType === 'arraybuffer') {
	        data = toArrayBuffer(concat(fragments, messageLength));
	      } else if (this._binaryType === 'blob') {
	        data = new Blob(fragments);
	      } else {
	        data = fragments;
	      }

	      if (this._allowSynchronousEvents) {
	        this.emit('message', data, true);
	        this._state = GET_INFO;
	      } else {
	        this._state = DEFER_EVENT;
	        setImmediate(() => {
	          this.emit('message', data, true);
	          this._state = GET_INFO;
	          this.startLoop(cb);
	        });
	      }
	    } else {
	      const buf = concat(fragments, messageLength);

	      if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
	        const error = this.createError(
	          Error,
	          'invalid UTF-8 sequence',
	          true,
	          1007,
	          'WS_ERR_INVALID_UTF8'
	        );

	        cb(error);
	        return;
	      }

	      if (this._state === INFLATING || this._allowSynchronousEvents) {
	        this.emit('message', buf, false);
	        this._state = GET_INFO;
	      } else {
	        this._state = DEFER_EVENT;
	        setImmediate(() => {
	          this.emit('message', buf, false);
	          this._state = GET_INFO;
	          this.startLoop(cb);
	        });
	      }
	    }
	  }

	  /**
	   * Handles a control message.
	   *
	   * @param {Buffer} data Data to handle
	   * @return {(Error|RangeError|undefined)} A possible error
	   * @private
	   */
	  controlMessage(data, cb) {
	    if (this._opcode === 0x08) {
	      if (data.length === 0) {
	        this._loop = false;
	        this.emit('conclude', 1005, EMPTY_BUFFER);
	        this.end();
	      } else {
	        const code = data.readUInt16BE(0);

	        if (!isValidStatusCode(code)) {
	          const error = this.createError(
	            RangeError,
	            `invalid status code ${code}`,
	            true,
	            1002,
	            'WS_ERR_INVALID_CLOSE_CODE'
	          );

	          cb(error);
	          return;
	        }

	        const buf = new FastBuffer(
	          data.buffer,
	          data.byteOffset + 2,
	          data.length - 2
	        );

	        if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
	          const error = this.createError(
	            Error,
	            'invalid UTF-8 sequence',
	            true,
	            1007,
	            'WS_ERR_INVALID_UTF8'
	          );

	          cb(error);
	          return;
	        }

	        this._loop = false;
	        this.emit('conclude', code, buf);
	        this.end();
	      }

	      this._state = GET_INFO;
	      return;
	    }

	    if (this._allowSynchronousEvents) {
	      this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
	      this._state = GET_INFO;
	    } else {
	      this._state = DEFER_EVENT;
	      setImmediate(() => {
	        this.emit(this._opcode === 0x09 ? 'ping' : 'pong', data);
	        this._state = GET_INFO;
	        this.startLoop(cb);
	      });
	    }
	  }

	  /**
	   * Builds an error object.
	   *
	   * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
	   * @param {String} message The error message
	   * @param {Boolean} prefix Specifies whether or not to add a default prefix to
	   *     `message`
	   * @param {Number} statusCode The status code
	   * @param {String} errorCode The exposed error code
	   * @return {(Error|RangeError)} The error
	   * @private
	   */
	  createError(ErrorCtor, message, prefix, statusCode, errorCode) {
	    this._loop = false;
	    this._errored = true;

	    const err = new ErrorCtor(
	      prefix ? `Invalid WebSocket frame: ${message}` : message
	    );

	    Error.captureStackTrace(err, this.createError);
	    err.code = errorCode;
	    err[kStatusCode] = statusCode;
	    return err;
	  }
	}

	receiver = Receiver;
	return receiver;
}

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex" }] */

var sender;
var hasRequiredSender;

function requireSender () {
	if (hasRequiredSender) return sender;
	hasRequiredSender = 1;

	const { Duplex } = require$$0$2;
	const { randomFillSync } = require$$1;
	const {
	  types: { isUint8Array }
	} = require$$2;

	const PerMessageDeflate = requirePermessageDeflate();
	const { EMPTY_BUFFER, kWebSocket, NOOP } = requireConstants();
	const { isBlob, isValidStatusCode } = requireValidation();
	const { mask: applyMask, toBuffer } = requireBufferUtil();

	const kByteLength = Symbol('kByteLength');
	const maskBuffer = Buffer.alloc(4);
	const RANDOM_POOL_SIZE = 8 * 1024;
	let randomPool;
	let randomPoolPointer = RANDOM_POOL_SIZE;

	const DEFAULT = 0;
	const DEFLATING = 1;
	const GET_BLOB_DATA = 2;

	/**
	 * HyBi Sender implementation.
	 */
	class Sender {
	  /**
	   * Creates a Sender instance.
	   *
	   * @param {Duplex} socket The connection socket
	   * @param {Object} [extensions] An object containing the negotiated extensions
	   * @param {Function} [generateMask] The function used to generate the masking
	   *     key
	   */
	  constructor(socket, extensions, generateMask) {
	    this._extensions = extensions || {};

	    if (generateMask) {
	      this._generateMask = generateMask;
	      this._maskBuffer = Buffer.alloc(4);
	    }

	    this._socket = socket;

	    this._firstFragment = true;
	    this._compress = false;

	    this._bufferedBytes = 0;
	    this._queue = [];
	    this._state = DEFAULT;
	    this.onerror = NOOP;
	    this[kWebSocket] = undefined;
	  }

	  /**
	   * Frames a piece of data according to the HyBi WebSocket protocol.
	   *
	   * @param {(Buffer|String)} data The data to frame
	   * @param {Object} options Options object
	   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
	   *     FIN bit
	   * @param {Function} [options.generateMask] The function used to generate the
	   *     masking key
	   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
	   *     `data`
	   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
	   *     key
	   * @param {Number} options.opcode The opcode
	   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
	   *     modified
	   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
	   *     RSV1 bit
	   * @return {(Buffer|String)[]} The framed data
	   * @public
	   */
	  static frame(data, options) {
	    let mask;
	    let merge = false;
	    let offset = 2;
	    let skipMasking = false;

	    if (options.mask) {
	      mask = options.maskBuffer || maskBuffer;

	      if (options.generateMask) {
	        options.generateMask(mask);
	      } else {
	        if (randomPoolPointer === RANDOM_POOL_SIZE) {
	          /* istanbul ignore else  */
	          if (randomPool === undefined) {
	            //
	            // This is lazily initialized because server-sent frames must not
	            // be masked so it may never be used.
	            //
	            randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
	          }

	          randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
	          randomPoolPointer = 0;
	        }

	        mask[0] = randomPool[randomPoolPointer++];
	        mask[1] = randomPool[randomPoolPointer++];
	        mask[2] = randomPool[randomPoolPointer++];
	        mask[3] = randomPool[randomPoolPointer++];
	      }

	      skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
	      offset = 6;
	    }

	    let dataLength;

	    if (typeof data === 'string') {
	      if (
	        (!options.mask || skipMasking) &&
	        options[kByteLength] !== undefined
	      ) {
	        dataLength = options[kByteLength];
	      } else {
	        data = Buffer.from(data);
	        dataLength = data.length;
	      }
	    } else {
	      dataLength = data.length;
	      merge = options.mask && options.readOnly && !skipMasking;
	    }

	    let payloadLength = dataLength;

	    if (dataLength >= 65536) {
	      offset += 8;
	      payloadLength = 127;
	    } else if (dataLength > 125) {
	      offset += 2;
	      payloadLength = 126;
	    }

	    const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);

	    target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
	    if (options.rsv1) target[0] |= 0x40;

	    target[1] = payloadLength;

	    if (payloadLength === 126) {
	      target.writeUInt16BE(dataLength, 2);
	    } else if (payloadLength === 127) {
	      target[2] = target[3] = 0;
	      target.writeUIntBE(dataLength, 4, 6);
	    }

	    if (!options.mask) return [target, data];

	    target[1] |= 0x80;
	    target[offset - 4] = mask[0];
	    target[offset - 3] = mask[1];
	    target[offset - 2] = mask[2];
	    target[offset - 1] = mask[3];

	    if (skipMasking) return [target, data];

	    if (merge) {
	      applyMask(data, mask, target, offset, dataLength);
	      return [target];
	    }

	    applyMask(data, mask, data, 0, dataLength);
	    return [target, data];
	  }

	  /**
	   * Sends a close message to the other peer.
	   *
	   * @param {Number} [code] The status code component of the body
	   * @param {(String|Buffer)} [data] The message component of the body
	   * @param {Boolean} [mask=false] Specifies whether or not to mask the message
	   * @param {Function} [cb] Callback
	   * @public
	   */
	  close(code, data, mask, cb) {
	    let buf;

	    if (code === undefined) {
	      buf = EMPTY_BUFFER;
	    } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
	      throw new TypeError('First argument must be a valid error code number');
	    } else if (data === undefined || !data.length) {
	      buf = Buffer.allocUnsafe(2);
	      buf.writeUInt16BE(code, 0);
	    } else {
	      const length = Buffer.byteLength(data);

	      if (length > 123) {
	        throw new RangeError('The message must not be greater than 123 bytes');
	      }

	      buf = Buffer.allocUnsafe(2 + length);
	      buf.writeUInt16BE(code, 0);

	      if (typeof data === 'string') {
	        buf.write(data, 2);
	      } else if (isUint8Array(data)) {
	        buf.set(data, 2);
	      } else {
	        throw new TypeError('Second argument must be a string or a Uint8Array');
	      }
	    }

	    const options = {
	      [kByteLength]: buf.length,
	      fin: true,
	      generateMask: this._generateMask,
	      mask,
	      maskBuffer: this._maskBuffer,
	      opcode: 0x08,
	      readOnly: false,
	      rsv1: false
	    };

	    if (this._state !== DEFAULT) {
	      this.enqueue([this.dispatch, buf, false, options, cb]);
	    } else {
	      this.sendFrame(Sender.frame(buf, options), cb);
	    }
	  }

	  /**
	   * Sends a ping message to the other peer.
	   *
	   * @param {*} data The message to send
	   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
	   * @param {Function} [cb] Callback
	   * @public
	   */
	  ping(data, mask, cb) {
	    let byteLength;
	    let readOnly;

	    if (typeof data === 'string') {
	      byteLength = Buffer.byteLength(data);
	      readOnly = false;
	    } else if (isBlob(data)) {
	      byteLength = data.size;
	      readOnly = false;
	    } else {
	      data = toBuffer(data);
	      byteLength = data.length;
	      readOnly = toBuffer.readOnly;
	    }

	    if (byteLength > 125) {
	      throw new RangeError('The data size must not be greater than 125 bytes');
	    }

	    const options = {
	      [kByteLength]: byteLength,
	      fin: true,
	      generateMask: this._generateMask,
	      mask,
	      maskBuffer: this._maskBuffer,
	      opcode: 0x09,
	      readOnly,
	      rsv1: false
	    };

	    if (isBlob(data)) {
	      if (this._state !== DEFAULT) {
	        this.enqueue([this.getBlobData, data, false, options, cb]);
	      } else {
	        this.getBlobData(data, false, options, cb);
	      }
	    } else if (this._state !== DEFAULT) {
	      this.enqueue([this.dispatch, data, false, options, cb]);
	    } else {
	      this.sendFrame(Sender.frame(data, options), cb);
	    }
	  }

	  /**
	   * Sends a pong message to the other peer.
	   *
	   * @param {*} data The message to send
	   * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
	   * @param {Function} [cb] Callback
	   * @public
	   */
	  pong(data, mask, cb) {
	    let byteLength;
	    let readOnly;

	    if (typeof data === 'string') {
	      byteLength = Buffer.byteLength(data);
	      readOnly = false;
	    } else if (isBlob(data)) {
	      byteLength = data.size;
	      readOnly = false;
	    } else {
	      data = toBuffer(data);
	      byteLength = data.length;
	      readOnly = toBuffer.readOnly;
	    }

	    if (byteLength > 125) {
	      throw new RangeError('The data size must not be greater than 125 bytes');
	    }

	    const options = {
	      [kByteLength]: byteLength,
	      fin: true,
	      generateMask: this._generateMask,
	      mask,
	      maskBuffer: this._maskBuffer,
	      opcode: 0x0a,
	      readOnly,
	      rsv1: false
	    };

	    if (isBlob(data)) {
	      if (this._state !== DEFAULT) {
	        this.enqueue([this.getBlobData, data, false, options, cb]);
	      } else {
	        this.getBlobData(data, false, options, cb);
	      }
	    } else if (this._state !== DEFAULT) {
	      this.enqueue([this.dispatch, data, false, options, cb]);
	    } else {
	      this.sendFrame(Sender.frame(data, options), cb);
	    }
	  }

	  /**
	   * Sends a data message to the other peer.
	   *
	   * @param {*} data The message to send
	   * @param {Object} options Options object
	   * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
	   *     or text
	   * @param {Boolean} [options.compress=false] Specifies whether or not to
	   *     compress `data`
	   * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
	   *     last one
	   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
	   *     `data`
	   * @param {Function} [cb] Callback
	   * @public
	   */
	  send(data, options, cb) {
	    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
	    let opcode = options.binary ? 2 : 1;
	    let rsv1 = options.compress;

	    let byteLength;
	    let readOnly;

	    if (typeof data === 'string') {
	      byteLength = Buffer.byteLength(data);
	      readOnly = false;
	    } else if (isBlob(data)) {
	      byteLength = data.size;
	      readOnly = false;
	    } else {
	      data = toBuffer(data);
	      byteLength = data.length;
	      readOnly = toBuffer.readOnly;
	    }

	    if (this._firstFragment) {
	      this._firstFragment = false;
	      if (
	        rsv1 &&
	        perMessageDeflate &&
	        perMessageDeflate.params[
	          perMessageDeflate._isServer
	            ? 'server_no_context_takeover'
	            : 'client_no_context_takeover'
	        ]
	      ) {
	        rsv1 = byteLength >= perMessageDeflate._threshold;
	      }
	      this._compress = rsv1;
	    } else {
	      rsv1 = false;
	      opcode = 0;
	    }

	    if (options.fin) this._firstFragment = true;

	    const opts = {
	      [kByteLength]: byteLength,
	      fin: options.fin,
	      generateMask: this._generateMask,
	      mask: options.mask,
	      maskBuffer: this._maskBuffer,
	      opcode,
	      readOnly,
	      rsv1
	    };

	    if (isBlob(data)) {
	      if (this._state !== DEFAULT) {
	        this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
	      } else {
	        this.getBlobData(data, this._compress, opts, cb);
	      }
	    } else if (this._state !== DEFAULT) {
	      this.enqueue([this.dispatch, data, this._compress, opts, cb]);
	    } else {
	      this.dispatch(data, this._compress, opts, cb);
	    }
	  }

	  /**
	   * Gets the contents of a blob as binary data.
	   *
	   * @param {Blob} blob The blob
	   * @param {Boolean} [compress=false] Specifies whether or not to compress
	   *     the data
	   * @param {Object} options Options object
	   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
	   *     FIN bit
	   * @param {Function} [options.generateMask] The function used to generate the
	   *     masking key
	   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
	   *     `data`
	   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
	   *     key
	   * @param {Number} options.opcode The opcode
	   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
	   *     modified
	   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
	   *     RSV1 bit
	   * @param {Function} [cb] Callback
	   * @private
	   */
	  getBlobData(blob, compress, options, cb) {
	    this._bufferedBytes += options[kByteLength];
	    this._state = GET_BLOB_DATA;

	    blob
	      .arrayBuffer()
	      .then((arrayBuffer) => {
	        if (this._socket.destroyed) {
	          const err = new Error(
	            'The socket was closed while the blob was being read'
	          );

	          //
	          // `callCallbacks` is called in the next tick to ensure that errors
	          // that might be thrown in the callbacks behave like errors thrown
	          // outside the promise chain.
	          //
	          process.nextTick(callCallbacks, this, err, cb);
	          return;
	        }

	        this._bufferedBytes -= options[kByteLength];
	        const data = toBuffer(arrayBuffer);

	        if (!compress) {
	          this._state = DEFAULT;
	          this.sendFrame(Sender.frame(data, options), cb);
	          this.dequeue();
	        } else {
	          this.dispatch(data, compress, options, cb);
	        }
	      })
	      .catch((err) => {
	        //
	        // `onError` is called in the next tick for the same reason that
	        // `callCallbacks` above is.
	        //
	        process.nextTick(onError, this, err, cb);
	      });
	  }

	  /**
	   * Dispatches a message.
	   *
	   * @param {(Buffer|String)} data The message to send
	   * @param {Boolean} [compress=false] Specifies whether or not to compress
	   *     `data`
	   * @param {Object} options Options object
	   * @param {Boolean} [options.fin=false] Specifies whether or not to set the
	   *     FIN bit
	   * @param {Function} [options.generateMask] The function used to generate the
	   *     masking key
	   * @param {Boolean} [options.mask=false] Specifies whether or not to mask
	   *     `data`
	   * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
	   *     key
	   * @param {Number} options.opcode The opcode
	   * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
	   *     modified
	   * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
	   *     RSV1 bit
	   * @param {Function} [cb] Callback
	   * @private
	   */
	  dispatch(data, compress, options, cb) {
	    if (!compress) {
	      this.sendFrame(Sender.frame(data, options), cb);
	      return;
	    }

	    const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];

	    this._bufferedBytes += options[kByteLength];
	    this._state = DEFLATING;
	    perMessageDeflate.compress(data, options.fin, (_, buf) => {
	      if (this._socket.destroyed) {
	        const err = new Error(
	          'The socket was closed while data was being compressed'
	        );

	        callCallbacks(this, err, cb);
	        return;
	      }

	      this._bufferedBytes -= options[kByteLength];
	      this._state = DEFAULT;
	      options.readOnly = false;
	      this.sendFrame(Sender.frame(buf, options), cb);
	      this.dequeue();
	    });
	  }

	  /**
	   * Executes queued send operations.
	   *
	   * @private
	   */
	  dequeue() {
	    while (this._state === DEFAULT && this._queue.length) {
	      const params = this._queue.shift();

	      this._bufferedBytes -= params[3][kByteLength];
	      Reflect.apply(params[0], this, params.slice(1));
	    }
	  }

	  /**
	   * Enqueues a send operation.
	   *
	   * @param {Array} params Send operation parameters.
	   * @private
	   */
	  enqueue(params) {
	    this._bufferedBytes += params[3][kByteLength];
	    this._queue.push(params);
	  }

	  /**
	   * Sends a frame.
	   *
	   * @param {(Buffer | String)[]} list The frame to send
	   * @param {Function} [cb] Callback
	   * @private
	   */
	  sendFrame(list, cb) {
	    if (list.length === 2) {
	      this._socket.cork();
	      this._socket.write(list[0]);
	      this._socket.write(list[1], cb);
	      this._socket.uncork();
	    } else {
	      this._socket.write(list[0], cb);
	    }
	  }
	}

	sender = Sender;

	/**
	 * Calls queued callbacks with an error.
	 *
	 * @param {Sender} sender The `Sender` instance
	 * @param {Error} err The error to call the callbacks with
	 * @param {Function} [cb] The first callback
	 * @private
	 */
	function callCallbacks(sender, err, cb) {
	  if (typeof cb === 'function') cb(err);

	  for (let i = 0; i < sender._queue.length; i++) {
	    const params = sender._queue[i];
	    const callback = params[params.length - 1];

	    if (typeof callback === 'function') callback(err);
	  }
	}

	/**
	 * Handles a `Sender` error.
	 *
	 * @param {Sender} sender The `Sender` instance
	 * @param {Error} err The error
	 * @param {Function} [cb] The first pending callback
	 * @private
	 */
	function onError(sender, err, cb) {
	  callCallbacks(sender, err, cb);
	  sender.onerror(err);
	}
	return sender;
}

var eventTarget;
var hasRequiredEventTarget;

function requireEventTarget () {
	if (hasRequiredEventTarget) return eventTarget;
	hasRequiredEventTarget = 1;

	const { kForOnEventAttribute, kListener } = requireConstants();

	const kCode = Symbol('kCode');
	const kData = Symbol('kData');
	const kError = Symbol('kError');
	const kMessage = Symbol('kMessage');
	const kReason = Symbol('kReason');
	const kTarget = Symbol('kTarget');
	const kType = Symbol('kType');
	const kWasClean = Symbol('kWasClean');

	/**
	 * Class representing an event.
	 */
	class Event {
	  /**
	   * Create a new `Event`.
	   *
	   * @param {String} type The name of the event
	   * @throws {TypeError} If the `type` argument is not specified
	   */
	  constructor(type) {
	    this[kTarget] = null;
	    this[kType] = type;
	  }

	  /**
	   * @type {*}
	   */
	  get target() {
	    return this[kTarget];
	  }

	  /**
	   * @type {String}
	   */
	  get type() {
	    return this[kType];
	  }
	}

	Object.defineProperty(Event.prototype, 'target', { enumerable: true });
	Object.defineProperty(Event.prototype, 'type', { enumerable: true });

	/**
	 * Class representing a close event.
	 *
	 * @extends Event
	 */
	class CloseEvent extends Event {
	  /**
	   * Create a new `CloseEvent`.
	   *
	   * @param {String} type The name of the event
	   * @param {Object} [options] A dictionary object that allows for setting
	   *     attributes via object members of the same name
	   * @param {Number} [options.code=0] The status code explaining why the
	   *     connection was closed
	   * @param {String} [options.reason=''] A human-readable string explaining why
	   *     the connection was closed
	   * @param {Boolean} [options.wasClean=false] Indicates whether or not the
	   *     connection was cleanly closed
	   */
	  constructor(type, options = {}) {
	    super(type);

	    this[kCode] = options.code === undefined ? 0 : options.code;
	    this[kReason] = options.reason === undefined ? '' : options.reason;
	    this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
	  }

	  /**
	   * @type {Number}
	   */
	  get code() {
	    return this[kCode];
	  }

	  /**
	   * @type {String}
	   */
	  get reason() {
	    return this[kReason];
	  }

	  /**
	   * @type {Boolean}
	   */
	  get wasClean() {
	    return this[kWasClean];
	  }
	}

	Object.defineProperty(CloseEvent.prototype, 'code', { enumerable: true });
	Object.defineProperty(CloseEvent.prototype, 'reason', { enumerable: true });
	Object.defineProperty(CloseEvent.prototype, 'wasClean', { enumerable: true });

	/**
	 * Class representing an error event.
	 *
	 * @extends Event
	 */
	class ErrorEvent extends Event {
	  /**
	   * Create a new `ErrorEvent`.
	   *
	   * @param {String} type The name of the event
	   * @param {Object} [options] A dictionary object that allows for setting
	   *     attributes via object members of the same name
	   * @param {*} [options.error=null] The error that generated this event
	   * @param {String} [options.message=''] The error message
	   */
	  constructor(type, options = {}) {
	    super(type);

	    this[kError] = options.error === undefined ? null : options.error;
	    this[kMessage] = options.message === undefined ? '' : options.message;
	  }

	  /**
	   * @type {*}
	   */
	  get error() {
	    return this[kError];
	  }

	  /**
	   * @type {String}
	   */
	  get message() {
	    return this[kMessage];
	  }
	}

	Object.defineProperty(ErrorEvent.prototype, 'error', { enumerable: true });
	Object.defineProperty(ErrorEvent.prototype, 'message', { enumerable: true });

	/**
	 * Class representing a message event.
	 *
	 * @extends Event
	 */
	class MessageEvent extends Event {
	  /**
	   * Create a new `MessageEvent`.
	   *
	   * @param {String} type The name of the event
	   * @param {Object} [options] A dictionary object that allows for setting
	   *     attributes via object members of the same name
	   * @param {*} [options.data=null] The message content
	   */
	  constructor(type, options = {}) {
	    super(type);

	    this[kData] = options.data === undefined ? null : options.data;
	  }

	  /**
	   * @type {*}
	   */
	  get data() {
	    return this[kData];
	  }
	}

	Object.defineProperty(MessageEvent.prototype, 'data', { enumerable: true });

	/**
	 * This provides methods for emulating the `EventTarget` interface. It's not
	 * meant to be used directly.
	 *
	 * @mixin
	 */
	const EventTarget = {
	  /**
	   * Register an event listener.
	   *
	   * @param {String} type A string representing the event type to listen for
	   * @param {(Function|Object)} handler The listener to add
	   * @param {Object} [options] An options object specifies characteristics about
	   *     the event listener
	   * @param {Boolean} [options.once=false] A `Boolean` indicating that the
	   *     listener should be invoked at most once after being added. If `true`,
	   *     the listener would be automatically removed when invoked.
	   * @public
	   */
	  addEventListener(type, handler, options = {}) {
	    for (const listener of this.listeners(type)) {
	      if (
	        !options[kForOnEventAttribute] &&
	        listener[kListener] === handler &&
	        !listener[kForOnEventAttribute]
	      ) {
	        return;
	      }
	    }

	    let wrapper;

	    if (type === 'message') {
	      wrapper = function onMessage(data, isBinary) {
	        const event = new MessageEvent('message', {
	          data: isBinary ? data : data.toString()
	        });

	        event[kTarget] = this;
	        callListener(handler, this, event);
	      };
	    } else if (type === 'close') {
	      wrapper = function onClose(code, message) {
	        const event = new CloseEvent('close', {
	          code,
	          reason: message.toString(),
	          wasClean: this._closeFrameReceived && this._closeFrameSent
	        });

	        event[kTarget] = this;
	        callListener(handler, this, event);
	      };
	    } else if (type === 'error') {
	      wrapper = function onError(error) {
	        const event = new ErrorEvent('error', {
	          error,
	          message: error.message
	        });

	        event[kTarget] = this;
	        callListener(handler, this, event);
	      };
	    } else if (type === 'open') {
	      wrapper = function onOpen() {
	        const event = new Event('open');

	        event[kTarget] = this;
	        callListener(handler, this, event);
	      };
	    } else {
	      return;
	    }

	    wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
	    wrapper[kListener] = handler;

	    if (options.once) {
	      this.once(type, wrapper);
	    } else {
	      this.on(type, wrapper);
	    }
	  },

	  /**
	   * Remove an event listener.
	   *
	   * @param {String} type A string representing the event type to remove
	   * @param {(Function|Object)} handler The listener to remove
	   * @public
	   */
	  removeEventListener(type, handler) {
	    for (const listener of this.listeners(type)) {
	      if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
	        this.removeListener(type, listener);
	        break;
	      }
	    }
	  }
	};

	eventTarget = {
	  CloseEvent,
	  ErrorEvent,
	  Event,
	  EventTarget,
	  MessageEvent
	};

	/**
	 * Call an event listener
	 *
	 * @param {(Function|Object)} listener The listener to call
	 * @param {*} thisArg The value to use as `this`` when calling the listener
	 * @param {Event} event The event to pass to the listener
	 * @private
	 */
	function callListener(listener, thisArg, event) {
	  if (typeof listener === 'object' && listener.handleEvent) {
	    listener.handleEvent.call(listener, event);
	  } else {
	    listener.call(thisArg, event);
	  }
	}
	return eventTarget;
}

var extension;
var hasRequiredExtension;

function requireExtension () {
	if (hasRequiredExtension) return extension;
	hasRequiredExtension = 1;

	const { tokenChars } = requireValidation();

	/**
	 * Adds an offer to the map of extension offers or a parameter to the map of
	 * parameters.
	 *
	 * @param {Object} dest The map of extension offers or parameters
	 * @param {String} name The extension or parameter name
	 * @param {(Object|Boolean|String)} elem The extension parameters or the
	 *     parameter value
	 * @private
	 */
	function push(dest, name, elem) {
	  if (dest[name] === undefined) dest[name] = [elem];
	  else dest[name].push(elem);
	}

	/**
	 * Parses the `Sec-WebSocket-Extensions` header into an object.
	 *
	 * @param {String} header The field value of the header
	 * @return {Object} The parsed object
	 * @public
	 */
	function parse(header) {
	  const offers = Object.create(null);
	  let params = Object.create(null);
	  let mustUnescape = false;
	  let isEscaping = false;
	  let inQuotes = false;
	  let extensionName;
	  let paramName;
	  let start = -1;
	  let code = -1;
	  let end = -1;
	  let i = 0;

	  for (; i < header.length; i++) {
	    code = header.charCodeAt(i);

	    if (extensionName === undefined) {
	      if (end === -1 && tokenChars[code] === 1) {
	        if (start === -1) start = i;
	      } else if (
	        i !== 0 &&
	        (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
	      ) {
	        if (end === -1 && start !== -1) end = i;
	      } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
	        if (start === -1) {
	          throw new SyntaxError(`Unexpected character at index ${i}`);
	        }

	        if (end === -1) end = i;
	        const name = header.slice(start, end);
	        if (code === 0x2c) {
	          push(offers, name, params);
	          params = Object.create(null);
	        } else {
	          extensionName = name;
	        }

	        start = end = -1;
	      } else {
	        throw new SyntaxError(`Unexpected character at index ${i}`);
	      }
	    } else if (paramName === undefined) {
	      if (end === -1 && tokenChars[code] === 1) {
	        if (start === -1) start = i;
	      } else if (code === 0x20 || code === 0x09) {
	        if (end === -1 && start !== -1) end = i;
	      } else if (code === 0x3b || code === 0x2c) {
	        if (start === -1) {
	          throw new SyntaxError(`Unexpected character at index ${i}`);
	        }

	        if (end === -1) end = i;
	        push(params, header.slice(start, end), true);
	        if (code === 0x2c) {
	          push(offers, extensionName, params);
	          params = Object.create(null);
	          extensionName = undefined;
	        }

	        start = end = -1;
	      } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
	        paramName = header.slice(start, i);
	        start = end = -1;
	      } else {
	        throw new SyntaxError(`Unexpected character at index ${i}`);
	      }
	    } else {
	      //
	      // The value of a quoted-string after unescaping must conform to the
	      // token ABNF, so only token characters are valid.
	      // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
	      //
	      if (isEscaping) {
	        if (tokenChars[code] !== 1) {
	          throw new SyntaxError(`Unexpected character at index ${i}`);
	        }
	        if (start === -1) start = i;
	        else if (!mustUnescape) mustUnescape = true;
	        isEscaping = false;
	      } else if (inQuotes) {
	        if (tokenChars[code] === 1) {
	          if (start === -1) start = i;
	        } else if (code === 0x22 /* '"' */ && start !== -1) {
	          inQuotes = false;
	          end = i;
	        } else if (code === 0x5c /* '\' */) {
	          isEscaping = true;
	        } else {
	          throw new SyntaxError(`Unexpected character at index ${i}`);
	        }
	      } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
	        inQuotes = true;
	      } else if (end === -1 && tokenChars[code] === 1) {
	        if (start === -1) start = i;
	      } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
	        if (end === -1) end = i;
	      } else if (code === 0x3b || code === 0x2c) {
	        if (start === -1) {
	          throw new SyntaxError(`Unexpected character at index ${i}`);
	        }

	        if (end === -1) end = i;
	        let value = header.slice(start, end);
	        if (mustUnescape) {
	          value = value.replace(/\\/g, '');
	          mustUnescape = false;
	        }
	        push(params, paramName, value);
	        if (code === 0x2c) {
	          push(offers, extensionName, params);
	          params = Object.create(null);
	          extensionName = undefined;
	        }

	        paramName = undefined;
	        start = end = -1;
	      } else {
	        throw new SyntaxError(`Unexpected character at index ${i}`);
	      }
	    }
	  }

	  if (start === -1 || inQuotes || code === 0x20 || code === 0x09) {
	    throw new SyntaxError('Unexpected end of input');
	  }

	  if (end === -1) end = i;
	  const token = header.slice(start, end);
	  if (extensionName === undefined) {
	    push(offers, token, params);
	  } else {
	    if (paramName === undefined) {
	      push(params, token, true);
	    } else if (mustUnescape) {
	      push(params, paramName, token.replace(/\\/g, ''));
	    } else {
	      push(params, paramName, token);
	    }
	    push(offers, extensionName, params);
	  }

	  return offers;
	}

	/**
	 * Builds the `Sec-WebSocket-Extensions` header field value.
	 *
	 * @param {Object} extensions The map of extensions and parameters to format
	 * @return {String} A string representing the given object
	 * @public
	 */
	function format(extensions) {
	  return Object.keys(extensions)
	    .map((extension) => {
	      let configurations = extensions[extension];
	      if (!Array.isArray(configurations)) configurations = [configurations];
	      return configurations
	        .map((params) => {
	          return [extension]
	            .concat(
	              Object.keys(params).map((k) => {
	                let values = params[k];
	                if (!Array.isArray(values)) values = [values];
	                return values
	                  .map((v) => (v === true ? k : `${k}=${v}`))
	                  .join('; ');
	              })
	            )
	            .join('; ');
	        })
	        .join(', ');
	    })
	    .join(', ');
	}

	extension = { format, parse };
	return extension;
}

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex|Readable$", "caughtErrors": "none" }] */

var websocket;
var hasRequiredWebsocket;

function requireWebsocket () {
	if (hasRequiredWebsocket) return websocket;
	hasRequiredWebsocket = 1;

	const EventEmitter = require$$0$3;
	const https = require$$1$1;
	const http = require$$2$1;
	const net = require$$3;
	const tls = require$$4;
	const { randomBytes, createHash } = require$$1;
	const { Duplex, Readable } = require$$0$2;
	const { URL } = require$$7;

	const PerMessageDeflate = requirePermessageDeflate();
	const Receiver = requireReceiver();
	const Sender = requireSender();
	const { isBlob } = requireValidation();

	const {
	  BINARY_TYPES,
	  CLOSE_TIMEOUT,
	  EMPTY_BUFFER,
	  GUID,
	  kForOnEventAttribute,
	  kListener,
	  kStatusCode,
	  kWebSocket,
	  NOOP
	} = requireConstants();
	const {
	  EventTarget: { addEventListener, removeEventListener }
	} = requireEventTarget();
	const { format, parse } = requireExtension();
	const { toBuffer } = requireBufferUtil();

	const kAborted = Symbol('kAborted');
	const protocolVersions = [8, 13];
	const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
	const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

	/**
	 * Class representing a WebSocket.
	 *
	 * @extends EventEmitter
	 */
	class WebSocket extends EventEmitter {
	  /**
	   * Create a new `WebSocket`.
	   *
	   * @param {(String|URL)} address The URL to which to connect
	   * @param {(String|String[])} [protocols] The subprotocols
	   * @param {Object} [options] Connection options
	   */
	  constructor(address, protocols, options) {
	    super();

	    this._binaryType = BINARY_TYPES[0];
	    this._closeCode = 1006;
	    this._closeFrameReceived = false;
	    this._closeFrameSent = false;
	    this._closeMessage = EMPTY_BUFFER;
	    this._closeTimer = null;
	    this._errorEmitted = false;
	    this._extensions = {};
	    this._paused = false;
	    this._protocol = '';
	    this._readyState = WebSocket.CONNECTING;
	    this._receiver = null;
	    this._sender = null;
	    this._socket = null;

	    if (address !== null) {
	      this._bufferedAmount = 0;
	      this._isServer = false;
	      this._redirects = 0;

	      if (protocols === undefined) {
	        protocols = [];
	      } else if (!Array.isArray(protocols)) {
	        if (typeof protocols === 'object' && protocols !== null) {
	          options = protocols;
	          protocols = [];
	        } else {
	          protocols = [protocols];
	        }
	      }

	      initAsClient(this, address, protocols, options);
	    } else {
	      this._autoPong = options.autoPong;
	      this._closeTimeout = options.closeTimeout;
	      this._isServer = true;
	    }
	  }

	  /**
	   * For historical reasons, the custom "nodebuffer" type is used by the default
	   * instead of "blob".
	   *
	   * @type {String}
	   */
	  get binaryType() {
	    return this._binaryType;
	  }

	  set binaryType(type) {
	    if (!BINARY_TYPES.includes(type)) return;

	    this._binaryType = type;

	    //
	    // Allow to change `binaryType` on the fly.
	    //
	    if (this._receiver) this._receiver._binaryType = type;
	  }

	  /**
	   * @type {Number}
	   */
	  get bufferedAmount() {
	    if (!this._socket) return this._bufferedAmount;

	    return this._socket._writableState.length + this._sender._bufferedBytes;
	  }

	  /**
	   * @type {String}
	   */
	  get extensions() {
	    return Object.keys(this._extensions).join();
	  }

	  /**
	   * @type {Boolean}
	   */
	  get isPaused() {
	    return this._paused;
	  }

	  /**
	   * @type {Function}
	   */
	  /* istanbul ignore next */
	  get onclose() {
	    return null;
	  }

	  /**
	   * @type {Function}
	   */
	  /* istanbul ignore next */
	  get onerror() {
	    return null;
	  }

	  /**
	   * @type {Function}
	   */
	  /* istanbul ignore next */
	  get onopen() {
	    return null;
	  }

	  /**
	   * @type {Function}
	   */
	  /* istanbul ignore next */
	  get onmessage() {
	    return null;
	  }

	  /**
	   * @type {String}
	   */
	  get protocol() {
	    return this._protocol;
	  }

	  /**
	   * @type {Number}
	   */
	  get readyState() {
	    return this._readyState;
	  }

	  /**
	   * @type {String}
	   */
	  get url() {
	    return this._url;
	  }

	  /**
	   * Set up the socket and the internal resources.
	   *
	   * @param {Duplex} socket The network socket between the server and client
	   * @param {Buffer} head The first packet of the upgraded stream
	   * @param {Object} options Options object
	   * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
	   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
	   *     multiple times in the same tick
	   * @param {Function} [options.generateMask] The function used to generate the
	   *     masking key
	   * @param {Number} [options.maxBufferedChunks=0] The maximum number of
	   *     buffered data chunks
	   * @param {Number} [options.maxFragments=0] The maximum number of message
	   *     fragments
	   * @param {Number} [options.maxPayload=0] The maximum allowed message size
	   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
	   *     not to skip UTF-8 validation for text and close messages
	   * @private
	   */
	  setSocket(socket, head, options) {
	    const receiver = new Receiver({
	      allowSynchronousEvents: options.allowSynchronousEvents,
	      binaryType: this.binaryType,
	      extensions: this._extensions,
	      isServer: this._isServer,
	      maxBufferedChunks: options.maxBufferedChunks,
	      maxFragments: options.maxFragments,
	      maxPayload: options.maxPayload,
	      skipUTF8Validation: options.skipUTF8Validation
	    });

	    const sender = new Sender(socket, this._extensions, options.generateMask);

	    this._receiver = receiver;
	    this._sender = sender;
	    this._socket = socket;

	    receiver[kWebSocket] = this;
	    sender[kWebSocket] = this;
	    socket[kWebSocket] = this;

	    receiver.on('conclude', receiverOnConclude);
	    receiver.on('drain', receiverOnDrain);
	    receiver.on('error', receiverOnError);
	    receiver.on('message', receiverOnMessage);
	    receiver.on('ping', receiverOnPing);
	    receiver.on('pong', receiverOnPong);

	    sender.onerror = senderOnError;

	    //
	    // These methods may not be available if `socket` is just a `Duplex`.
	    //
	    if (socket.setTimeout) socket.setTimeout(0);
	    if (socket.setNoDelay) socket.setNoDelay();

	    if (head.length > 0) socket.unshift(head);

	    socket.on('close', socketOnClose);
	    socket.on('data', socketOnData);
	    socket.on('end', socketOnEnd);
	    socket.on('error', socketOnError);

	    this._readyState = WebSocket.OPEN;
	    this.emit('open');
	  }

	  /**
	   * Emit the `'close'` event.
	   *
	   * @private
	   */
	  emitClose() {
	    if (!this._socket) {
	      this._readyState = WebSocket.CLOSED;
	      this.emit('close', this._closeCode, this._closeMessage);
	      return;
	    }

	    if (this._extensions[PerMessageDeflate.extensionName]) {
	      this._extensions[PerMessageDeflate.extensionName].cleanup();
	    }

	    this._receiver.removeAllListeners();
	    this._readyState = WebSocket.CLOSED;
	    this.emit('close', this._closeCode, this._closeMessage);
	  }

	  /**
	   * Start a closing handshake.
	   *
	   *          +----------+   +-----------+   +----------+
	   *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
	   *    |     +----------+   +-----------+   +----------+     |
	   *          +----------+   +-----------+         |
	   * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
	   *          +----------+   +-----------+   |
	   *    |           |                        |   +---+        |
	   *                +------------------------+-->|fin| - - - -
	   *    |         +---+                      |   +---+
	   *     - - - - -|fin|<---------------------+
	   *              +---+
	   *
	   * @param {Number} [code] Status code explaining why the connection is closing
	   * @param {(String|Buffer)} [data] The reason why the connection is
	   *     closing
	   * @public
	   */
	  close(code, data) {
	    if (this.readyState === WebSocket.CLOSED) return;
	    if (this.readyState === WebSocket.CONNECTING) {
	      const msg = 'WebSocket was closed before the connection was established';
	      abortHandshake(this, this._req, msg);
	      return;
	    }

	    if (this.readyState === WebSocket.CLOSING) {
	      if (
	        this._closeFrameSent &&
	        (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
	      ) {
	        this._socket.end();
	      }

	      return;
	    }

	    this._readyState = WebSocket.CLOSING;
	    this._sender.close(code, data, !this._isServer, (err) => {
	      //
	      // This error is handled by the `'error'` listener on the socket. We only
	      // want to know if the close frame has been sent here.
	      //
	      if (err) return;

	      this._closeFrameSent = true;

	      if (
	        this._closeFrameReceived ||
	        this._receiver._writableState.errorEmitted
	      ) {
	        this._socket.end();
	      }
	    });

	    setCloseTimer(this);
	  }

	  /**
	   * Pause the socket.
	   *
	   * @public
	   */
	  pause() {
	    if (
	      this.readyState === WebSocket.CONNECTING ||
	      this.readyState === WebSocket.CLOSED
	    ) {
	      return;
	    }

	    this._paused = true;
	    this._socket.pause();
	  }

	  /**
	   * Send a ping.
	   *
	   * @param {*} [data] The data to send
	   * @param {Boolean} [mask] Indicates whether or not to mask `data`
	   * @param {Function} [cb] Callback which is executed when the ping is sent
	   * @public
	   */
	  ping(data, mask, cb) {
	    if (this.readyState === WebSocket.CONNECTING) {
	      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
	    }

	    if (typeof data === 'function') {
	      cb = data;
	      data = mask = undefined;
	    } else if (typeof mask === 'function') {
	      cb = mask;
	      mask = undefined;
	    }

	    if (typeof data === 'number') data = data.toString();

	    if (this.readyState !== WebSocket.OPEN) {
	      sendAfterClose(this, data, cb);
	      return;
	    }

	    if (mask === undefined) mask = !this._isServer;
	    this._sender.ping(data || EMPTY_BUFFER, mask, cb);
	  }

	  /**
	   * Send a pong.
	   *
	   * @param {*} [data] The data to send
	   * @param {Boolean} [mask] Indicates whether or not to mask `data`
	   * @param {Function} [cb] Callback which is executed when the pong is sent
	   * @public
	   */
	  pong(data, mask, cb) {
	    if (this.readyState === WebSocket.CONNECTING) {
	      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
	    }

	    if (typeof data === 'function') {
	      cb = data;
	      data = mask = undefined;
	    } else if (typeof mask === 'function') {
	      cb = mask;
	      mask = undefined;
	    }

	    if (typeof data === 'number') data = data.toString();

	    if (this.readyState !== WebSocket.OPEN) {
	      sendAfterClose(this, data, cb);
	      return;
	    }

	    if (mask === undefined) mask = !this._isServer;
	    this._sender.pong(data || EMPTY_BUFFER, mask, cb);
	  }

	  /**
	   * Resume the socket.
	   *
	   * @public
	   */
	  resume() {
	    if (
	      this.readyState === WebSocket.CONNECTING ||
	      this.readyState === WebSocket.CLOSED
	    ) {
	      return;
	    }

	    this._paused = false;
	    if (!this._receiver._writableState.needDrain) this._socket.resume();
	  }

	  /**
	   * Send a data message.
	   *
	   * @param {*} data The message to send
	   * @param {Object} [options] Options object
	   * @param {Boolean} [options.binary] Specifies whether `data` is binary or
	   *     text
	   * @param {Boolean} [options.compress] Specifies whether or not to compress
	   *     `data`
	   * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
	   *     last one
	   * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
	   * @param {Function} [cb] Callback which is executed when data is written out
	   * @public
	   */
	  send(data, options, cb) {
	    if (this.readyState === WebSocket.CONNECTING) {
	      throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
	    }

	    if (typeof options === 'function') {
	      cb = options;
	      options = {};
	    }

	    if (typeof data === 'number') data = data.toString();

	    if (this.readyState !== WebSocket.OPEN) {
	      sendAfterClose(this, data, cb);
	      return;
	    }

	    const opts = {
	      binary: typeof data !== 'string',
	      mask: !this._isServer,
	      compress: true,
	      fin: true,
	      ...options
	    };

	    if (!this._extensions[PerMessageDeflate.extensionName]) {
	      opts.compress = false;
	    }

	    this._sender.send(data || EMPTY_BUFFER, opts, cb);
	  }

	  /**
	   * Forcibly close the connection.
	   *
	   * @public
	   */
	  terminate() {
	    if (this.readyState === WebSocket.CLOSED) return;
	    if (this.readyState === WebSocket.CONNECTING) {
	      const msg = 'WebSocket was closed before the connection was established';
	      abortHandshake(this, this._req, msg);
	      return;
	    }

	    if (this._socket) {
	      this._readyState = WebSocket.CLOSING;
	      this._socket.destroy();
	    }
	  }
	}

	/**
	 * @constant {Number} CONNECTING
	 * @memberof WebSocket
	 */
	Object.defineProperty(WebSocket, 'CONNECTING', {
	  enumerable: true,
	  value: readyStates.indexOf('CONNECTING')
	});

	/**
	 * @constant {Number} CONNECTING
	 * @memberof WebSocket.prototype
	 */
	Object.defineProperty(WebSocket.prototype, 'CONNECTING', {
	  enumerable: true,
	  value: readyStates.indexOf('CONNECTING')
	});

	/**
	 * @constant {Number} OPEN
	 * @memberof WebSocket
	 */
	Object.defineProperty(WebSocket, 'OPEN', {
	  enumerable: true,
	  value: readyStates.indexOf('OPEN')
	});

	/**
	 * @constant {Number} OPEN
	 * @memberof WebSocket.prototype
	 */
	Object.defineProperty(WebSocket.prototype, 'OPEN', {
	  enumerable: true,
	  value: readyStates.indexOf('OPEN')
	});

	/**
	 * @constant {Number} CLOSING
	 * @memberof WebSocket
	 */
	Object.defineProperty(WebSocket, 'CLOSING', {
	  enumerable: true,
	  value: readyStates.indexOf('CLOSING')
	});

	/**
	 * @constant {Number} CLOSING
	 * @memberof WebSocket.prototype
	 */
	Object.defineProperty(WebSocket.prototype, 'CLOSING', {
	  enumerable: true,
	  value: readyStates.indexOf('CLOSING')
	});

	/**
	 * @constant {Number} CLOSED
	 * @memberof WebSocket
	 */
	Object.defineProperty(WebSocket, 'CLOSED', {
	  enumerable: true,
	  value: readyStates.indexOf('CLOSED')
	});

	/**
	 * @constant {Number} CLOSED
	 * @memberof WebSocket.prototype
	 */
	Object.defineProperty(WebSocket.prototype, 'CLOSED', {
	  enumerable: true,
	  value: readyStates.indexOf('CLOSED')
	});

	[
	  'binaryType',
	  'bufferedAmount',
	  'extensions',
	  'isPaused',
	  'protocol',
	  'readyState',
	  'url'
	].forEach((property) => {
	  Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
	});

	//
	// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
	// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
	//
	['open', 'error', 'close', 'message'].forEach((method) => {
	  Object.defineProperty(WebSocket.prototype, `on${method}`, {
	    enumerable: true,
	    get() {
	      for (const listener of this.listeners(method)) {
	        if (listener[kForOnEventAttribute]) return listener[kListener];
	      }

	      return null;
	    },
	    set(handler) {
	      for (const listener of this.listeners(method)) {
	        if (listener[kForOnEventAttribute]) {
	          this.removeListener(method, listener);
	          break;
	        }
	      }

	      if (typeof handler !== 'function') return;

	      this.addEventListener(method, handler, {
	        [kForOnEventAttribute]: true
	      });
	    }
	  });
	});

	WebSocket.prototype.addEventListener = addEventListener;
	WebSocket.prototype.removeEventListener = removeEventListener;

	websocket = WebSocket;

	/**
	 * Initialize a WebSocket client.
	 *
	 * @param {WebSocket} websocket The client to initialize
	 * @param {(String|URL)} address The URL to which to connect
	 * @param {Array} protocols The subprotocols
	 * @param {Object} [options] Connection options
	 * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
	 *     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
	 *     times in the same tick
	 * @param {Boolean} [options.autoPong=true] Specifies whether or not to
	 *     automatically send a pong in response to a ping
	 * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to wait
	 *     for the closing handshake to finish after `websocket.close()` is called
	 * @param {Function} [options.finishRequest] A function which can be used to
	 *     customize the headers of each http request before it is sent
	 * @param {Boolean} [options.followRedirects=false] Whether or not to follow
	 *     redirects
	 * @param {Function} [options.generateMask] The function used to generate the
	 *     masking key
	 * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
	 *     handshake request
	 * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
	 *     buffered data chunks
	 * @param {Number} [options.maxFragments=16384] The maximum number of message
	 *     fragments
	 * @param {Number} [options.maxPayload=104857600] The maximum allowed message
	 *     size
	 * @param {Number} [options.maxRedirects=10] The maximum number of redirects
	 *     allowed
	 * @param {String} [options.origin] Value of the `Origin` or
	 *     `Sec-WebSocket-Origin` header
	 * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
	 *     permessage-deflate
	 * @param {Number} [options.protocolVersion=13] Value of the
	 *     `Sec-WebSocket-Version` header
	 * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
	 *     not to skip UTF-8 validation for text and close messages
	 * @private
	 */
	function initAsClient(websocket, address, protocols, options) {
	  const opts = {
	    allowSynchronousEvents: true,
	    autoPong: true,
	    closeTimeout: CLOSE_TIMEOUT,
	    protocolVersion: protocolVersions[1],
	    maxBufferedChunks: 256 * 1024,
	    maxFragments: 16 * 1024,
	    maxPayload: 100 * 1024 * 1024,
	    skipUTF8Validation: false,
	    perMessageDeflate: true,
	    followRedirects: false,
	    maxRedirects: 10,
	    ...options,
	    socketPath: undefined,
	    hostname: undefined,
	    protocol: undefined,
	    timeout: undefined,
	    method: 'GET',
	    host: undefined,
	    path: undefined,
	    port: undefined
	  };

	  websocket._autoPong = opts.autoPong;
	  websocket._closeTimeout = opts.closeTimeout;

	  if (!protocolVersions.includes(opts.protocolVersion)) {
	    throw new RangeError(
	      `Unsupported protocol version: ${opts.protocolVersion} ` +
	        `(supported versions: ${protocolVersions.join(', ')})`
	    );
	  }

	  let parsedUrl;

	  if (address instanceof URL) {
	    parsedUrl = address;
	  } else {
	    try {
	      parsedUrl = new URL(address);
	    } catch {
	      throw new SyntaxError(`Invalid URL: ${address}`);
	    }
	  }

	  if (parsedUrl.protocol === 'http:') {
	    parsedUrl.protocol = 'ws:';
	  } else if (parsedUrl.protocol === 'https:') {
	    parsedUrl.protocol = 'wss:';
	  }

	  websocket._url = parsedUrl.href;

	  const isSecure = parsedUrl.protocol === 'wss:';
	  const isIpcUrl = parsedUrl.protocol === 'ws+unix:';
	  let invalidUrlMessage;

	  if (parsedUrl.protocol !== 'ws:' && !isSecure && !isIpcUrl) {
	    invalidUrlMessage =
	      'The URL\'s protocol must be one of "ws:", "wss:", ' +
	      '"http:", "https:", or "ws+unix:"';
	  } else if (isIpcUrl && !parsedUrl.pathname) {
	    invalidUrlMessage = "The URL's pathname is empty";
	  } else if (parsedUrl.hash) {
	    invalidUrlMessage = 'The URL contains a fragment identifier';
	  }

	  if (invalidUrlMessage) {
	    const err = new SyntaxError(invalidUrlMessage);

	    if (websocket._redirects === 0) {
	      throw err;
	    } else {
	      emitErrorAndClose(websocket, err);
	      return;
	    }
	  }

	  const defaultPort = isSecure ? 443 : 80;
	  const key = randomBytes(16).toString('base64');
	  const request = isSecure ? https.request : http.request;
	  const protocolSet = new Set();
	  let perMessageDeflate;

	  opts.createConnection =
	    opts.createConnection || (isSecure ? tlsConnect : netConnect);
	  opts.defaultPort = opts.defaultPort || defaultPort;
	  opts.port = parsedUrl.port || defaultPort;
	  opts.host = parsedUrl.hostname.startsWith('[')
	    ? parsedUrl.hostname.slice(1, -1)
	    : parsedUrl.hostname;
	  opts.headers = {
	    ...opts.headers,
	    'Sec-WebSocket-Version': opts.protocolVersion,
	    'Sec-WebSocket-Key': key,
	    Connection: 'Upgrade',
	    Upgrade: 'websocket'
	  };
	  opts.path = parsedUrl.pathname + parsedUrl.search;
	  opts.timeout = opts.handshakeTimeout;

	  if (opts.perMessageDeflate) {
	    perMessageDeflate = new PerMessageDeflate({
	      ...opts.perMessageDeflate,
	      isServer: false,
	      maxPayload: opts.maxPayload
	    });
	    opts.headers['Sec-WebSocket-Extensions'] = format({
	      [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
	    });
	  }
	  if (protocols.length) {
	    for (const protocol of protocols) {
	      if (
	        typeof protocol !== 'string' ||
	        !subprotocolRegex.test(protocol) ||
	        protocolSet.has(protocol)
	      ) {
	        throw new SyntaxError(
	          'An invalid or duplicated subprotocol was specified'
	        );
	      }

	      protocolSet.add(protocol);
	    }

	    opts.headers['Sec-WebSocket-Protocol'] = protocols.join(',');
	  }
	  if (opts.origin) {
	    if (opts.protocolVersion < 13) {
	      opts.headers['Sec-WebSocket-Origin'] = opts.origin;
	    } else {
	      opts.headers.Origin = opts.origin;
	    }
	  }
	  if (parsedUrl.username || parsedUrl.password) {
	    opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
	  }

	  if (isIpcUrl) {
	    const parts = opts.path.split(':');

	    opts.socketPath = parts[0];
	    opts.path = parts[1];
	  }

	  let req;

	  if (opts.followRedirects) {
	    if (websocket._redirects === 0) {
	      websocket._originalIpc = isIpcUrl;
	      websocket._originalSecure = isSecure;
	      websocket._originalHostOrSocketPath = isIpcUrl
	        ? opts.socketPath
	        : parsedUrl.host;

	      const headers = options && options.headers;

	      //
	      // Shallow copy the user provided options so that headers can be changed
	      // without mutating the original object.
	      //
	      options = { ...options, headers: {} };

	      if (headers) {
	        for (const [key, value] of Object.entries(headers)) {
	          options.headers[key.toLowerCase()] = value;
	        }
	      }
	    } else if (websocket.listenerCount('redirect') === 0) {
	      const isSameHost = isIpcUrl
	        ? websocket._originalIpc
	          ? opts.socketPath === websocket._originalHostOrSocketPath
	          : false
	        : websocket._originalIpc
	          ? false
	          : parsedUrl.host === websocket._originalHostOrSocketPath;

	      if (!isSameHost || (websocket._originalSecure && !isSecure)) {
	        //
	        // Match curl 7.77.0 behavior and drop the following headers. These
	        // headers are also dropped when following a redirect to a subdomain.
	        //
	        delete opts.headers.authorization;
	        delete opts.headers.cookie;

	        if (!isSameHost) delete opts.headers.host;

	        opts.auth = undefined;
	      }
	    }

	    //
	    // Match curl 7.77.0 behavior and make the first `Authorization` header win.
	    // If the `Authorization` header is set, then there is nothing to do as it
	    // will take precedence.
	    //
	    if (opts.auth && !options.headers.authorization) {
	      options.headers.authorization =
	        'Basic ' + Buffer.from(opts.auth).toString('base64');
	    }

	    req = websocket._req = request(opts);

	    if (websocket._redirects) {
	      //
	      // Unlike what is done for the `'upgrade'` event, no early exit is
	      // triggered here if the user calls `websocket.close()` or
	      // `websocket.terminate()` from a listener of the `'redirect'` event. This
	      // is because the user can also call `request.destroy()` with an error
	      // before calling `websocket.close()` or `websocket.terminate()` and this
	      // would result in an error being emitted on the `request` object with no
	      // `'error'` event listeners attached.
	      //
	      websocket.emit('redirect', websocket.url, req);
	    }
	  } else {
	    req = websocket._req = request(opts);
	  }

	  if (opts.timeout) {
	    req.on('timeout', () => {
	      abortHandshake(websocket, req, 'Opening handshake has timed out');
	    });
	  }

	  req.on('error', (err) => {
	    if (req === null || req[kAborted]) return;

	    req = websocket._req = null;
	    emitErrorAndClose(websocket, err);
	  });

	  req.on('response', (res) => {
	    const location = res.headers.location;
	    const statusCode = res.statusCode;

	    if (
	      location &&
	      opts.followRedirects &&
	      statusCode >= 300 &&
	      statusCode < 400
	    ) {
	      if (++websocket._redirects > opts.maxRedirects) {
	        abortHandshake(websocket, req, 'Maximum redirects exceeded');
	        return;
	      }

	      req.abort();

	      let addr;

	      try {
	        addr = new URL(location, address);
	      } catch (e) {
	        const err = new SyntaxError(`Invalid URL: ${location}`);
	        emitErrorAndClose(websocket, err);
	        return;
	      }

	      initAsClient(websocket, addr, protocols, options);
	    } else if (!websocket.emit('unexpected-response', req, res)) {
	      abortHandshake(
	        websocket,
	        req,
	        `Unexpected server response: ${res.statusCode}`
	      );
	    }
	  });

	  req.on('upgrade', (res, socket, head) => {
	    websocket.emit('upgrade', res);

	    //
	    // The user may have closed the connection from a listener of the
	    // `'upgrade'` event.
	    //
	    if (websocket.readyState !== WebSocket.CONNECTING) return;

	    req = websocket._req = null;

	    const upgrade = res.headers.upgrade;

	    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
	      abortHandshake(websocket, socket, 'Invalid Upgrade header');
	      return;
	    }

	    const digest = createHash('sha1')
	      .update(key + GUID)
	      .digest('base64');

	    if (res.headers['sec-websocket-accept'] !== digest) {
	      abortHandshake(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
	      return;
	    }

	    const serverProt = res.headers['sec-websocket-protocol'];
	    let protError;

	    if (serverProt !== undefined) {
	      if (!protocolSet.size) {
	        protError = 'Server sent a subprotocol but none was requested';
	      } else if (!protocolSet.has(serverProt)) {
	        protError = 'Server sent an invalid subprotocol';
	      }
	    } else if (protocolSet.size) {
	      protError = 'Server sent no subprotocol';
	    }

	    if (protError) {
	      abortHandshake(websocket, socket, protError);
	      return;
	    }

	    if (serverProt) websocket._protocol = serverProt;

	    const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

	    if (secWebSocketExtensions !== undefined) {
	      if (!perMessageDeflate) {
	        const message =
	          'Server sent a Sec-WebSocket-Extensions header but no extension ' +
	          'was requested';
	        abortHandshake(websocket, socket, message);
	        return;
	      }

	      let extensions;

	      try {
	        extensions = parse(secWebSocketExtensions);
	      } catch (err) {
	        const message = 'Invalid Sec-WebSocket-Extensions header';
	        abortHandshake(websocket, socket, message);
	        return;
	      }

	      const extensionNames = Object.keys(extensions);

	      if (
	        extensionNames.length !== 1 ||
	        extensionNames[0] !== PerMessageDeflate.extensionName
	      ) {
	        const message = 'Server indicated an extension that was not requested';
	        abortHandshake(websocket, socket, message);
	        return;
	      }

	      try {
	        perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
	      } catch (err) {
	        const message = 'Invalid Sec-WebSocket-Extensions header';
	        abortHandshake(websocket, socket, message);
	        return;
	      }

	      websocket._extensions[PerMessageDeflate.extensionName] =
	        perMessageDeflate;
	    }

	    websocket.setSocket(socket, head, {
	      allowSynchronousEvents: opts.allowSynchronousEvents,
	      generateMask: opts.generateMask,
	      maxBufferedChunks: opts.maxBufferedChunks,
	      maxFragments: opts.maxFragments,
	      maxPayload: opts.maxPayload,
	      skipUTF8Validation: opts.skipUTF8Validation
	    });
	  });

	  if (opts.finishRequest) {
	    opts.finishRequest(req, websocket);
	  } else {
	    req.end();
	  }
	}

	/**
	 * Emit the `'error'` and `'close'` events.
	 *
	 * @param {WebSocket} websocket The WebSocket instance
	 * @param {Error} The error to emit
	 * @private
	 */
	function emitErrorAndClose(websocket, err) {
	  websocket._readyState = WebSocket.CLOSING;
	  //
	  // The following assignment is practically useless and is done only for
	  // consistency.
	  //
	  websocket._errorEmitted = true;
	  websocket.emit('error', err);
	  websocket.emitClose();
	}

	/**
	 * Create a `net.Socket` and initiate a connection.
	 *
	 * @param {Object} options Connection options
	 * @return {net.Socket} The newly created socket used to start the connection
	 * @private
	 */
	function netConnect(options) {
	  options.path = options.socketPath;
	  return net.connect(options);
	}

	/**
	 * Create a `tls.TLSSocket` and initiate a connection.
	 *
	 * @param {Object} options Connection options
	 * @return {tls.TLSSocket} The newly created socket used to start the connection
	 * @private
	 */
	function tlsConnect(options) {
	  options.path = undefined;

	  if (!options.servername && options.servername !== '') {
	    options.servername = net.isIP(options.host) ? '' : options.host;
	  }

	  return tls.connect(options);
	}

	/**
	 * Abort the handshake and emit an error.
	 *
	 * @param {WebSocket} websocket The WebSocket instance
	 * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
	 *     abort or the socket to destroy
	 * @param {String} message The error message
	 * @private
	 */
	function abortHandshake(websocket, stream, message) {
	  websocket._readyState = WebSocket.CLOSING;

	  const err = new Error(message);
	  Error.captureStackTrace(err, abortHandshake);

	  if (stream.setHeader) {
	    stream[kAborted] = true;
	    stream.abort();

	    if (stream.socket && !stream.socket.destroyed) {
	      //
	      // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
	      // called after the request completed. See
	      // https://github.com/websockets/ws/issues/1869.
	      //
	      stream.socket.destroy();
	    }

	    process.nextTick(emitErrorAndClose, websocket, err);
	  } else {
	    stream.destroy(err);
	    stream.once('error', websocket.emit.bind(websocket, 'error'));
	    stream.once('close', websocket.emitClose.bind(websocket));
	  }
	}

	/**
	 * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
	 * when the `readyState` attribute is `CLOSING` or `CLOSED`.
	 *
	 * @param {WebSocket} websocket The WebSocket instance
	 * @param {*} [data] The data to send
	 * @param {Function} [cb] Callback
	 * @private
	 */
	function sendAfterClose(websocket, data, cb) {
	  if (data) {
	    const length = isBlob(data) ? data.size : toBuffer(data).length;

	    //
	    // The `_bufferedAmount` property is used only when the peer is a client and
	    // the opening handshake fails. Under these circumstances, in fact, the
	    // `setSocket()` method is not called, so the `_socket` and `_sender`
	    // properties are set to `null`.
	    //
	    if (websocket._socket) websocket._sender._bufferedBytes += length;
	    else websocket._bufferedAmount += length;
	  }

	  if (cb) {
	    const err = new Error(
	      `WebSocket is not open: readyState ${websocket.readyState} ` +
	        `(${readyStates[websocket.readyState]})`
	    );
	    process.nextTick(cb, err);
	  }
	}

	/**
	 * The listener of the `Receiver` `'conclude'` event.
	 *
	 * @param {Number} code The status code
	 * @param {Buffer} reason The reason for closing
	 * @private
	 */
	function receiverOnConclude(code, reason) {
	  const websocket = this[kWebSocket];

	  websocket._closeFrameReceived = true;
	  websocket._closeMessage = reason;
	  websocket._closeCode = code;

	  if (websocket._socket[kWebSocket] === undefined) return;

	  websocket._socket.removeListener('data', socketOnData);
	  process.nextTick(resume, websocket._socket);

	  if (code === 1005) websocket.close();
	  else websocket.close(code, reason);
	}

	/**
	 * The listener of the `Receiver` `'drain'` event.
	 *
	 * @private
	 */
	function receiverOnDrain() {
	  const websocket = this[kWebSocket];

	  if (!websocket.isPaused) websocket._socket.resume();
	}

	/**
	 * The listener of the `Receiver` `'error'` event.
	 *
	 * @param {(RangeError|Error)} err The emitted error
	 * @private
	 */
	function receiverOnError(err) {
	  const websocket = this[kWebSocket];

	  if (websocket._socket[kWebSocket] !== undefined) {
	    websocket._socket.removeListener('data', socketOnData);

	    //
	    // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
	    // https://github.com/websockets/ws/issues/1940.
	    //
	    process.nextTick(resume, websocket._socket);

	    websocket.close(err[kStatusCode]);
	  }

	  if (!websocket._errorEmitted) {
	    websocket._errorEmitted = true;
	    websocket.emit('error', err);
	  }
	}

	/**
	 * The listener of the `Receiver` `'finish'` event.
	 *
	 * @private
	 */
	function receiverOnFinish() {
	  this[kWebSocket].emitClose();
	}

	/**
	 * The listener of the `Receiver` `'message'` event.
	 *
	 * @param {Buffer|ArrayBuffer|Buffer[])} data The message
	 * @param {Boolean} isBinary Specifies whether the message is binary or not
	 * @private
	 */
	function receiverOnMessage(data, isBinary) {
	  this[kWebSocket].emit('message', data, isBinary);
	}

	/**
	 * The listener of the `Receiver` `'ping'` event.
	 *
	 * @param {Buffer} data The data included in the ping frame
	 * @private
	 */
	function receiverOnPing(data) {
	  const websocket = this[kWebSocket];

	  if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
	  websocket.emit('ping', data);
	}

	/**
	 * The listener of the `Receiver` `'pong'` event.
	 *
	 * @param {Buffer} data The data included in the pong frame
	 * @private
	 */
	function receiverOnPong(data) {
	  this[kWebSocket].emit('pong', data);
	}

	/**
	 * Resume a readable stream
	 *
	 * @param {Readable} stream The readable stream
	 * @private
	 */
	function resume(stream) {
	  stream.resume();
	}

	/**
	 * The `Sender` error event handler.
	 *
	 * @param {Error} The error
	 * @private
	 */
	function senderOnError(err) {
	  const websocket = this[kWebSocket];

	  if (websocket.readyState === WebSocket.CLOSED) return;
	  if (websocket.readyState === WebSocket.OPEN) {
	    websocket._readyState = WebSocket.CLOSING;
	    setCloseTimer(websocket);
	  }

	  //
	  // `socket.end()` is used instead of `socket.destroy()` to allow the other
	  // peer to finish sending queued data. There is no need to set a timer here
	  // because `CLOSING` means that it is already set or not needed.
	  //
	  this._socket.end();

	  if (!websocket._errorEmitted) {
	    websocket._errorEmitted = true;
	    websocket.emit('error', err);
	  }
	}

	/**
	 * Set a timer to destroy the underlying raw socket of a WebSocket.
	 *
	 * @param {WebSocket} websocket The WebSocket instance
	 * @private
	 */
	function setCloseTimer(websocket) {
	  websocket._closeTimer = setTimeout(
	    websocket._socket.destroy.bind(websocket._socket),
	    websocket._closeTimeout
	  );
	}

	/**
	 * The listener of the socket `'close'` event.
	 *
	 * @private
	 */
	function socketOnClose() {
	  const websocket = this[kWebSocket];

	  this.removeListener('close', socketOnClose);
	  this.removeListener('data', socketOnData);
	  this.removeListener('end', socketOnEnd);

	  websocket._readyState = WebSocket.CLOSING;

	  //
	  // The close frame might not have been received or the `'end'` event emitted,
	  // for example, if the socket was destroyed due to an error. Ensure that the
	  // `receiver` stream is closed after writing any remaining buffered data to
	  // it. If the readable side of the socket is in flowing mode then there is no
	  // buffered data as everything has been already written. If instead, the
	  // socket is paused, any possible buffered data will be read as a single
	  // chunk.
	  //
	  if (
	    !this._readableState.endEmitted &&
	    !websocket._closeFrameReceived &&
	    !websocket._receiver._writableState.errorEmitted &&
	    this._readableState.length !== 0
	  ) {
	    const chunk = this.read(this._readableState.length);

	    websocket._receiver.write(chunk);
	  }

	  websocket._receiver.end();

	  this[kWebSocket] = undefined;

	  clearTimeout(websocket._closeTimer);

	  if (
	    websocket._receiver._writableState.finished ||
	    websocket._receiver._writableState.errorEmitted
	  ) {
	    websocket.emitClose();
	  } else {
	    websocket._receiver.on('error', receiverOnFinish);
	    websocket._receiver.on('finish', receiverOnFinish);
	  }
	}

	/**
	 * The listener of the socket `'data'` event.
	 *
	 * @param {Buffer} chunk A chunk of data
	 * @private
	 */
	function socketOnData(chunk) {
	  if (!this[kWebSocket]._receiver.write(chunk)) {
	    this.pause();
	  }
	}

	/**
	 * The listener of the socket `'end'` event.
	 *
	 * @private
	 */
	function socketOnEnd() {
	  const websocket = this[kWebSocket];

	  websocket._readyState = WebSocket.CLOSING;
	  websocket._receiver.end();
	  this.end();
	}

	/**
	 * The listener of the socket `'error'` event.
	 *
	 * @private
	 */
	function socketOnError() {
	  const websocket = this[kWebSocket];

	  this.removeListener('error', socketOnError);
	  this.on('error', NOOP);

	  if (websocket) {
	    websocket._readyState = WebSocket.CLOSING;
	    this.destroy();
	  }
	}
	return websocket;
}

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^WebSocket$" }] */

var stream;
var hasRequiredStream;

function requireStream () {
	if (hasRequiredStream) return stream;
	hasRequiredStream = 1;

	requireWebsocket();
	const { Duplex } = require$$0$2;

	/**
	 * Emits the `'close'` event on a stream.
	 *
	 * @param {Duplex} stream The stream.
	 * @private
	 */
	function emitClose(stream) {
	  stream.emit('close');
	}

	/**
	 * The listener of the `'end'` event.
	 *
	 * @private
	 */
	function duplexOnEnd() {
	  if (!this.destroyed && this._writableState.finished) {
	    this.destroy();
	  }
	}

	/**
	 * The listener of the `'error'` event.
	 *
	 * @param {Error} err The error
	 * @private
	 */
	function duplexOnError(err) {
	  this.removeListener('error', duplexOnError);
	  this.destroy();
	  if (this.listenerCount('error') === 0) {
	    // Do not suppress the throwing behavior.
	    this.emit('error', err);
	  }
	}

	/**
	 * Wraps a `WebSocket` in a duplex stream.
	 *
	 * @param {WebSocket} ws The `WebSocket` to wrap
	 * @param {Object} [options] The options for the `Duplex` constructor
	 * @return {Duplex} The duplex stream
	 * @public
	 */
	function createWebSocketStream(ws, options) {
	  let terminateOnDestroy = true;

	  const duplex = new Duplex({
	    ...options,
	    autoDestroy: false,
	    emitClose: false,
	    objectMode: false,
	    writableObjectMode: false
	  });

	  ws.on('message', function message(msg, isBinary) {
	    const data =
	      !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;

	    if (!duplex.push(data)) ws.pause();
	  });

	  ws.once('error', function error(err) {
	    if (duplex.destroyed) return;

	    // Prevent `ws.terminate()` from being called by `duplex._destroy()`.
	    //
	    // - If the `'error'` event is emitted before the `'open'` event, then
	    //   `ws.terminate()` is a noop as no socket is assigned.
	    // - Otherwise, the error is re-emitted by the listener of the `'error'`
	    //   event of the `Receiver` object. The listener already closes the
	    //   connection by calling `ws.close()`. This allows a close frame to be
	    //   sent to the other peer. If `ws.terminate()` is called right after this,
	    //   then the close frame might not be sent.
	    terminateOnDestroy = false;
	    duplex.destroy(err);
	  });

	  ws.once('close', function close() {
	    if (duplex.destroyed) return;

	    duplex.push(null);
	  });

	  duplex._destroy = function (err, callback) {
	    if (ws.readyState === ws.CLOSED) {
	      callback(err);
	      process.nextTick(emitClose, duplex);
	      return;
	    }

	    let called = false;

	    ws.once('error', function error(err) {
	      called = true;
	      callback(err);
	    });

	    ws.once('close', function close() {
	      if (!called) callback(err);
	      process.nextTick(emitClose, duplex);
	    });

	    if (terminateOnDestroy) ws.terminate();
	  };

	  duplex._final = function (callback) {
	    if (ws.readyState === ws.CONNECTING) {
	      ws.once('open', function open() {
	        duplex._final(callback);
	      });
	      return;
	    }

	    // If the value of the `_socket` property is `null` it means that `ws` is a
	    // client websocket and the handshake failed. In fact, when this happens, a
	    // socket is never assigned to the websocket. Wait for the `'error'` event
	    // that will be emitted by the websocket.
	    if (ws._socket === null) return;

	    if (ws._socket._writableState.finished) {
	      callback();
	      if (duplex._readableState.endEmitted) duplex.destroy();
	    } else {
	      ws._socket.once('finish', function finish() {
	        // `duplex` is not destroyed here because the `'end'` event will be
	        // emitted on `duplex` after this `'finish'` event. The EOF signaling
	        // `null` chunk is, in fact, pushed when the websocket emits `'close'`.
	        callback();
	      });
	      ws.close();
	    }
	  };

	  duplex._read = function () {
	    if (ws.isPaused) ws.resume();
	  };

	  duplex._write = function (chunk, encoding, callback) {
	    if (ws.readyState === ws.CONNECTING) {
	      ws.once('open', function open() {
	        duplex._write(chunk, encoding, callback);
	      });
	      return;
	    }

	    ws.send(chunk, callback);
	  };

	  duplex.on('end', duplexOnEnd);
	  duplex.on('error', duplexOnError);
	  return duplex;
	}

	stream = createWebSocketStream;
	return stream;
}

requireStream();

requireExtension();

requirePermessageDeflate();

requireReceiver();

requireSender();

var subprotocol;
var hasRequiredSubprotocol;

function requireSubprotocol () {
	if (hasRequiredSubprotocol) return subprotocol;
	hasRequiredSubprotocol = 1;

	const { tokenChars } = requireValidation();

	/**
	 * Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
	 *
	 * @param {String} header The field value of the header
	 * @return {Set} The subprotocol names
	 * @public
	 */
	function parse(header) {
	  const protocols = new Set();
	  let start = -1;
	  let end = -1;
	  let i = 0;

	  for (i; i < header.length; i++) {
	    const code = header.charCodeAt(i);

	    if (end === -1 && tokenChars[code] === 1) {
	      if (start === -1) start = i;
	    } else if (
	      i !== 0 &&
	      (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
	    ) {
	      if (end === -1 && start !== -1) end = i;
	    } else if (code === 0x2c /* ',' */) {
	      if (start === -1) {
	        throw new SyntaxError(`Unexpected character at index ${i}`);
	      }

	      if (end === -1) end = i;

	      const protocol = header.slice(start, end);

	      if (protocols.has(protocol)) {
	        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
	      }

	      protocols.add(protocol);
	      start = end = -1;
	    } else {
	      throw new SyntaxError(`Unexpected character at index ${i}`);
	    }
	  }

	  if (start === -1 || end !== -1) {
	    throw new SyntaxError('Unexpected end of input');
	  }

	  const protocol = header.slice(start, i);

	  if (protocols.has(protocol)) {
	    throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
	  }

	  protocols.add(protocol);
	  return protocols;
	}

	subprotocol = { parse };
	return subprotocol;
}

requireSubprotocol();

var websocketExports = requireWebsocket();
var WebSocket = /*@__PURE__*/getDefaultExportFromCjs(websocketExports);

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Duplex$", "caughtErrors": "none" }] */

var websocketServer;
var hasRequiredWebsocketServer;

function requireWebsocketServer () {
	if (hasRequiredWebsocketServer) return websocketServer;
	hasRequiredWebsocketServer = 1;

	const EventEmitter = require$$0$3;
	const http = require$$2$1;
	const { Duplex } = require$$0$2;
	const { createHash } = require$$1;

	const extension = requireExtension();
	const PerMessageDeflate = requirePermessageDeflate();
	const subprotocol = requireSubprotocol();
	const WebSocket = requireWebsocket();
	const { CLOSE_TIMEOUT, GUID, kWebSocket } = requireConstants();

	const keyRegex = /^[+/0-9A-Za-z]{22}==$/;

	const RUNNING = 0;
	const CLOSING = 1;
	const CLOSED = 2;

	/**
	 * Class representing a WebSocket server.
	 *
	 * @extends EventEmitter
	 */
	class WebSocketServer extends EventEmitter {
	  /**
	   * Create a `WebSocketServer` instance.
	   *
	   * @param {Object} options Configuration options
	   * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
	   *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
	   *     multiple times in the same tick
	   * @param {Boolean} [options.autoPong=true] Specifies whether or not to
	   *     automatically send a pong in response to a ping
	   * @param {Number} [options.backlog=511] The maximum length of the queue of
	   *     pending connections
	   * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
	   *     track clients
	   * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
	   *     wait for the closing handshake to finish after `websocket.close()` is
	   *     called
	   * @param {Function} [options.handleProtocols] A hook to handle protocols
	   * @param {String} [options.host] The hostname where to bind the server
	   * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
	   *     buffered data chunks
	   * @param {Number} [options.maxFragments=16384] The maximum number of message
	   *     fragments
	   * @param {Number} [options.maxPayload=104857600] The maximum allowed message
	   *     size
	   * @param {Boolean} [options.noServer=false] Enable no server mode
	   * @param {String} [options.path] Accept only connections matching this path
	   * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
	   *     permessage-deflate
	   * @param {Number} [options.port] The port where to bind the server
	   * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
	   *     server to use
	   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
	   *     not to skip UTF-8 validation for text and close messages
	   * @param {Function} [options.verifyClient] A hook to reject connections
	   * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
	   *     class to use. It must be the `WebSocket` class or class that extends it
	   * @param {Function} [callback] A listener for the `listening` event
	   */
	  constructor(options, callback) {
	    super();

	    options = {
	      allowSynchronousEvents: true,
	      autoPong: true,
	      maxBufferedChunks: 256 * 1024,
	      maxFragments: 16 * 1024,
	      maxPayload: 100 * 1024 * 1024,
	      skipUTF8Validation: false,
	      perMessageDeflate: false,
	      handleProtocols: null,
	      clientTracking: true,
	      closeTimeout: CLOSE_TIMEOUT,
	      verifyClient: null,
	      noServer: false,
	      backlog: null, // use default (511 as implemented in net.js)
	      server: null,
	      host: null,
	      path: null,
	      port: null,
	      WebSocket,
	      ...options
	    };

	    if (
	      (options.port == null && !options.server && !options.noServer) ||
	      (options.port != null && (options.server || options.noServer)) ||
	      (options.server && options.noServer)
	    ) {
	      throw new TypeError(
	        'One and only one of the "port", "server", or "noServer" options ' +
	          'must be specified'
	      );
	    }

	    if (options.port != null) {
	      this._server = http.createServer((req, res) => {
	        const body = http.STATUS_CODES[426];

	        res.writeHead(426, {
	          'Content-Length': body.length,
	          'Content-Type': 'text/plain'
	        });
	        res.end(body);
	      });
	      this._server.listen(
	        options.port,
	        options.host,
	        options.backlog,
	        callback
	      );
	    } else if (options.server) {
	      this._server = options.server;
	    }

	    if (this._server) {
	      const emitConnection = this.emit.bind(this, 'connection');

	      this._removeListeners = addListeners(this._server, {
	        listening: this.emit.bind(this, 'listening'),
	        error: this.emit.bind(this, 'error'),
	        upgrade: (req, socket, head) => {
	          this.handleUpgrade(req, socket, head, emitConnection);
	        }
	      });
	    }

	    if (options.perMessageDeflate === true) options.perMessageDeflate = {};
	    if (options.clientTracking) {
	      this.clients = new Set();
	      this._shouldEmitClose = false;
	    }

	    this.options = options;
	    this._state = RUNNING;
	  }

	  /**
	   * Returns the bound address, the address family name, and port of the server
	   * as reported by the operating system if listening on an IP socket.
	   * If the server is listening on a pipe or UNIX domain socket, the name is
	   * returned as a string.
	   *
	   * @return {(Object|String|null)} The address of the server
	   * @public
	   */
	  address() {
	    if (this.options.noServer) {
	      throw new Error('The server is operating in "noServer" mode');
	    }

	    if (!this._server) return null;
	    return this._server.address();
	  }

	  /**
	   * Stop the server from accepting new connections and emit the `'close'` event
	   * when all existing connections are closed.
	   *
	   * @param {Function} [cb] A one-time listener for the `'close'` event
	   * @public
	   */
	  close(cb) {
	    if (this._state === CLOSED) {
	      if (cb) {
	        this.once('close', () => {
	          cb(new Error('The server is not running'));
	        });
	      }

	      process.nextTick(emitClose, this);
	      return;
	    }

	    if (cb) this.once('close', cb);

	    if (this._state === CLOSING) return;
	    this._state = CLOSING;

	    if (this.options.noServer || this.options.server) {
	      if (this._server) {
	        this._removeListeners();
	        this._removeListeners = this._server = null;
	      }

	      if (this.clients) {
	        if (!this.clients.size) {
	          process.nextTick(emitClose, this);
	        } else {
	          this._shouldEmitClose = true;
	        }
	      } else {
	        process.nextTick(emitClose, this);
	      }
	    } else {
	      const server = this._server;

	      this._removeListeners();
	      this._removeListeners = this._server = null;

	      //
	      // The HTTP/S server was created internally. Close it, and rely on its
	      // `'close'` event.
	      //
	      server.close(() => {
	        emitClose(this);
	      });
	    }
	  }

	  /**
	   * See if a given request should be handled by this server instance.
	   *
	   * @param {http.IncomingMessage} req Request object to inspect
	   * @return {Boolean} `true` if the request is valid, else `false`
	   * @public
	   */
	  shouldHandle(req) {
	    if (this.options.path) {
	      const index = req.url.indexOf('?');
	      const pathname = index !== -1 ? req.url.slice(0, index) : req.url;

	      if (pathname !== this.options.path) return false;
	    }

	    return true;
	  }

	  /**
	   * Handle a HTTP Upgrade request.
	   *
	   * @param {http.IncomingMessage} req The request object
	   * @param {Duplex} socket The network socket between the server and client
	   * @param {Buffer} head The first packet of the upgraded stream
	   * @param {Function} cb Callback
	   * @public
	   */
	  handleUpgrade(req, socket, head, cb) {
	    socket.on('error', socketOnError);

	    const key = req.headers['sec-websocket-key'];
	    const upgrade = req.headers.upgrade;
	    const version = +req.headers['sec-websocket-version'];

	    if (req.method !== 'GET') {
	      const message = 'Invalid HTTP method';
	      abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
	      return;
	    }

	    if (upgrade === undefined || upgrade.toLowerCase() !== 'websocket') {
	      const message = 'Invalid Upgrade header';
	      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
	      return;
	    }

	    if (key === undefined || !keyRegex.test(key)) {
	      const message = 'Missing or invalid Sec-WebSocket-Key header';
	      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
	      return;
	    }

	    if (version !== 13 && version !== 8) {
	      const message = 'Missing or invalid Sec-WebSocket-Version header';
	      abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
	        'Sec-WebSocket-Version': '13, 8'
	      });
	      return;
	    }

	    if (!this.shouldHandle(req)) {
	      abortHandshake(socket, 400);
	      return;
	    }

	    const secWebSocketProtocol = req.headers['sec-websocket-protocol'];
	    let protocols = new Set();

	    if (secWebSocketProtocol !== undefined) {
	      try {
	        protocols = subprotocol.parse(secWebSocketProtocol);
	      } catch (err) {
	        const message = 'Invalid Sec-WebSocket-Protocol header';
	        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
	        return;
	      }
	    }

	    const secWebSocketExtensions = req.headers['sec-websocket-extensions'];
	    const extensions = {};

	    if (
	      this.options.perMessageDeflate &&
	      secWebSocketExtensions !== undefined
	    ) {
	      const perMessageDeflate = new PerMessageDeflate({
	        ...this.options.perMessageDeflate,
	        isServer: true,
	        maxPayload: this.options.maxPayload
	      });

	      try {
	        const offers = extension.parse(secWebSocketExtensions);

	        if (offers[PerMessageDeflate.extensionName]) {
	          perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
	          extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
	        }
	      } catch (err) {
	        const message =
	          'Invalid or unacceptable Sec-WebSocket-Extensions header';
	        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
	        return;
	      }
	    }

	    //
	    // Optionally call external client verification handler.
	    //
	    if (this.options.verifyClient) {
	      const info = {
	        origin:
	          req.headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`],
	        secure: !!(req.socket.authorized || req.socket.encrypted),
	        req
	      };

	      if (this.options.verifyClient.length === 2) {
	        this.options.verifyClient(info, (verified, code, message, headers) => {
	          if (!verified) {
	            return abortHandshake(socket, code || 401, message, headers);
	          }

	          this.completeUpgrade(
	            extensions,
	            key,
	            protocols,
	            req,
	            socket,
	            head,
	            cb
	          );
	        });
	        return;
	      }

	      if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
	    }

	    this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
	  }

	  /**
	   * Upgrade the connection to WebSocket.
	   *
	   * @param {Object} extensions The accepted extensions
	   * @param {String} key The value of the `Sec-WebSocket-Key` header
	   * @param {Set} protocols The subprotocols
	   * @param {http.IncomingMessage} req The request object
	   * @param {Duplex} socket The network socket between the server and client
	   * @param {Buffer} head The first packet of the upgraded stream
	   * @param {Function} cb Callback
	   * @throws {Error} If called more than once with the same socket
	   * @private
	   */
	  completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
	    //
	    // Destroy the socket if the client has already sent a FIN packet.
	    //
	    if (!socket.readable || !socket.writable) return socket.destroy();

	    if (socket[kWebSocket]) {
	      throw new Error(
	        'server.handleUpgrade() was called more than once with the same ' +
	          'socket, possibly due to a misconfiguration'
	      );
	    }

	    if (this._state > RUNNING) return abortHandshake(socket, 503);

	    const digest = createHash('sha1')
	      .update(key + GUID)
	      .digest('base64');

	    const headers = [
	      'HTTP/1.1 101 Switching Protocols',
	      'Upgrade: websocket',
	      'Connection: Upgrade',
	      `Sec-WebSocket-Accept: ${digest}`
	    ];

	    const ws = new this.options.WebSocket(null, undefined, this.options);

	    if (protocols.size) {
	      //
	      // Optionally call external protocol selection handler.
	      //
	      const protocol = this.options.handleProtocols
	        ? this.options.handleProtocols(protocols, req)
	        : protocols.values().next().value;

	      if (protocol) {
	        headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
	        ws._protocol = protocol;
	      }
	    }

	    if (extensions[PerMessageDeflate.extensionName]) {
	      const params = extensions[PerMessageDeflate.extensionName].params;
	      const value = extension.format({
	        [PerMessageDeflate.extensionName]: [params]
	      });
	      headers.push(`Sec-WebSocket-Extensions: ${value}`);
	      ws._extensions = extensions;
	    }

	    //
	    // Allow external modification/inspection of handshake headers.
	    //
	    this.emit('headers', headers, req);

	    socket.write(headers.concat('\r\n').join('\r\n'));
	    socket.removeListener('error', socketOnError);

	    ws.setSocket(socket, head, {
	      allowSynchronousEvents: this.options.allowSynchronousEvents,
	      maxBufferedChunks: this.options.maxBufferedChunks,
	      maxFragments: this.options.maxFragments,
	      maxPayload: this.options.maxPayload,
	      skipUTF8Validation: this.options.skipUTF8Validation
	    });

	    if (this.clients) {
	      this.clients.add(ws);
	      ws.on('close', () => {
	        this.clients.delete(ws);

	        if (this._shouldEmitClose && !this.clients.size) {
	          process.nextTick(emitClose, this);
	        }
	      });
	    }

	    cb(ws, req);
	  }
	}

	websocketServer = WebSocketServer;

	/**
	 * Add event listeners on an `EventEmitter` using a map of <event, listener>
	 * pairs.
	 *
	 * @param {EventEmitter} server The event emitter
	 * @param {Object.<String, Function>} map The listeners to add
	 * @return {Function} A function that will remove the added listeners when
	 *     called
	 * @private
	 */
	function addListeners(server, map) {
	  for (const event of Object.keys(map)) server.on(event, map[event]);

	  return function removeListeners() {
	    for (const event of Object.keys(map)) {
	      server.removeListener(event, map[event]);
	    }
	  };
	}

	/**
	 * Emit a `'close'` event on an `EventEmitter`.
	 *
	 * @param {EventEmitter} server The event emitter
	 * @private
	 */
	function emitClose(server) {
	  server._state = CLOSED;
	  server.emit('close');
	}

	/**
	 * Handle socket errors.
	 *
	 * @private
	 */
	function socketOnError() {
	  this.destroy();
	}

	/**
	 * Close the connection when preconditions are not fulfilled.
	 *
	 * @param {Duplex} socket The socket of the upgrade request
	 * @param {Number} code The HTTP response status code
	 * @param {String} [message] The HTTP response body
	 * @param {Object} [headers] Additional HTTP response headers
	 * @private
	 */
	function abortHandshake(socket, code, message, headers) {
	  //
	  // The socket is writable unless the user destroyed or ended it before calling
	  // `server.handleUpgrade()` or in the `verifyClient` function, which is a user
	  // error. Handling this does not make much sense as the worst that can happen
	  // is that some of the data written by the user might be discarded due to the
	  // call to `socket.end()` below, which triggers an `'error'` event that in
	  // turn causes the socket to be destroyed.
	  //
	  message = message || http.STATUS_CODES[code];
	  headers = {
	    Connection: 'close',
	    'Content-Type': 'text/html',
	    'Content-Length': Buffer.byteLength(message),
	    ...headers
	  };

	  socket.once('finish', socket.destroy);

	  socket.end(
	    `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` +
	      Object.keys(headers)
	        .map((h) => `${h}: ${headers[h]}`)
	        .join('\r\n') +
	      '\r\n\r\n' +
	      message
	  );
	}

	/**
	 * Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
	 * one listener for it, otherwise call `abortHandshake()`.
	 *
	 * @param {WebSocketServer} server The WebSocket server
	 * @param {http.IncomingMessage} req The request object
	 * @param {Duplex} socket The socket of the upgrade request
	 * @param {Number} code The HTTP response status code
	 * @param {String} message The HTTP response body
	 * @param {Object} [headers] The HTTP response headers
	 * @private
	 */
	function abortHandshakeOrEmitwsClientError(
	  server,
	  req,
	  socket,
	  code,
	  message,
	  headers
	) {
	  if (server.listenerCount('wsClientError')) {
	    const err = new Error(message);
	    Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);

	    server.emit('wsClientError', err, socket, req);
	  } else {
	    abortHandshake(socket, code, message, headers);
	  }
	}
	return websocketServer;
}

requireWebsocketServer();

/**!
 * @author Elgato
 * @module elgato/streamdeck
 * @license MIT
 * @copyright Copyright (c) Corsair Memory Inc.
 */
/**
 * Stream Deck device types.
 */
var DeviceType;
(function (DeviceType) {
    /**
     * Stream Deck, comprised of 15 customizable LCD keys in a 5 x 3 layout.
     */
    DeviceType[DeviceType["StreamDeck"] = 0] = "StreamDeck";
    /**
     * Stream Deck Mini, comprised of 6 customizable LCD keys in a 3 x 2 layout.
     */
    DeviceType[DeviceType["StreamDeckMini"] = 1] = "StreamDeckMini";
    /**
     * Stream Deck XL, comprised of 32 customizable LCD keys in an 8 x 4 layout.
     */
    DeviceType[DeviceType["StreamDeckXL"] = 2] = "StreamDeckXL";
    /**
     * Stream Deck Mobile, for iOS and Android.
     */
    DeviceType[DeviceType["StreamDeckMobile"] = 3] = "StreamDeckMobile";
    /**
     * Corsair G Keys, available on select Corsair keyboards.
     */
    DeviceType[DeviceType["CorsairGKeys"] = 4] = "CorsairGKeys";
    /**
     * Stream Deck Pedal, comprised of 3 customizable pedals.
     */
    DeviceType[DeviceType["StreamDeckPedal"] = 5] = "StreamDeckPedal";
    /**
     * Corsair Voyager laptop, comprising 10 buttons in a horizontal line above the keyboard.
     */
    DeviceType[DeviceType["CorsairVoyager"] = 6] = "CorsairVoyager";
    /**
     * Stream Deck +, comprised of 8 customizable LCD keys in a 4 x 2 layout, a touch strip, and 4 dials.
     */
    DeviceType[DeviceType["StreamDeckPlus"] = 7] = "StreamDeckPlus";
    /**
     * SCUF controller G keys, available on select SCUF controllers, for example SCUF Envision.
     */
    DeviceType[DeviceType["SCUFController"] = 8] = "SCUFController";
    /**
     * Stream Deck Neo, comprised of 8 customizable LCD keys in a 4 x 2 layout, an info bar, and 2 touch points for page navigation.
     */
    DeviceType[DeviceType["StreamDeckNeo"] = 9] = "StreamDeckNeo";
    /**
     * Stream Deck Studio, comprised of 32 customizable LCD keys in a 16 x 2 layout, and 2 dials (1 on either side).
     */
    DeviceType[DeviceType["StreamDeckStudio"] = 10] = "StreamDeckStudio";
    /**
     * Virtual Stream Deck, comprised of 1 to 64 action (on-screen) on a scalable canvas, with a maximum layout of 8 x 8.
     */
    DeviceType[DeviceType["VirtualStreamDeck"] = 11] = "VirtualStreamDeck";
    /**
     * High-performance gaming keyboard, with a built-in Stream Deck comprised of 12 customizable LCD keys in a 3 x 4 layout, an LCD screen, and 2 dials.
     */
    DeviceType[DeviceType["Galleon100SD"] = 12] = "Galleon100SD";
    /**
     * Stream Deck + XL, comprised of 36 customizable LCD keys in a 9 x 4 layout, a touch strip, and 6 dials.
     */
    DeviceType[DeviceType["StreamDeckPlusXL"] = 13] = "StreamDeckPlusXL";
})(DeviceType || (DeviceType = {}));

/**
 * List of available types that can be applied to {@link Bar} and {@link GBar} to determine their style.
 */
var BarSubType;
(function (BarSubType) {
    /**
     * Rectangle bar; the bar fills from left to right, determined by the {@link Bar.value}, similar to a standard progress bar.
     */
    BarSubType[BarSubType["Rectangle"] = 0] = "Rectangle";
    /**
     * Rectangle bar; the bar fills outwards from the centre of the bar, determined by the {@link Bar.value}.
     * @example
     * // Value is 2, range is 1-10.
     * // [  ███     ]
     * @example
     * // Value is 10, range is 1-10.
     * // [     █████]
     */
    BarSubType[BarSubType["DoubleRectangle"] = 1] = "DoubleRectangle";
    /**
     * Trapezoid bar, represented as a right-angle triangle; the bar fills from left to right, determined by the {@link Bar.value}, similar to a volume meter.
     */
    BarSubType[BarSubType["Trapezoid"] = 2] = "Trapezoid";
    /**
     * Trapezoid bar, represented by two right-angle triangles; the bar fills outwards from the centre of the bar, determined by the {@link Bar.value}. See {@link BarSubType.DoubleRectangle}.
     */
    BarSubType[BarSubType["DoubleTrapezoid"] = 3] = "DoubleTrapezoid";
    /**
     * Rounded rectangle bar; the bar fills from left to right, determined by the {@link Bar.value}, similar to a standard progress bar.
     */
    BarSubType[BarSubType["Groove"] = 4] = "Groove";
})(BarSubType || (BarSubType = {}));

/**
 * Defines the type of argument supplied by Stream Deck.
 */
var RegistrationParameter;
(function (RegistrationParameter) {
    /**
     * Identifies the argument that specifies the web socket port that Stream Deck is listening on.
     */
    RegistrationParameter["Port"] = "-port";
    /**
     * Identifies the argument that supplies information about the Stream Deck and the plugin.
     */
    RegistrationParameter["Info"] = "-info";
    /**
     * Identifies the argument that specifies the unique identifier that can be used when registering the plugin.
     */
    RegistrationParameter["PluginUUID"] = "-pluginUUID";
    /**
     * Identifies the argument that specifies the event to be sent to Stream Deck as part of the registration procedure.
     */
    RegistrationParameter["RegisterEvent"] = "-registerEvent";
})(RegistrationParameter || (RegistrationParameter = {}));

/**
 * Defines the target of a request, i.e. whether the request should update the Stream Deck hardware, Stream Deck software (application), or both, when calling `setImage` and `setState`.
 */
var Target;
(function (Target) {
    /**
     * Hardware and software should be updated as part of the request.
     */
    Target[Target["HardwareAndSoftware"] = 0] = "HardwareAndSoftware";
    /**
     * Hardware only should be updated as part of the request.
     */
    Target[Target["Hardware"] = 1] = "Hardware";
    /**
     * Software only should be updated as part of the request.
     */
    Target[Target["Software"] = 2] = "Software";
})(Target || (Target = {}));

/**
 * Provides information for a version, as parsed from a string denoted as a collection of numbers separated by a period, for example `1.45.2`, `4.0.2.13098`. Parsing is opinionated
 * and strings should strictly conform to the format `{major}[.{minor}[.{patch}[.{build}]]]`; version numbers that form the version are optional, and when `undefined` will default to
 * 0, for example the `minor`, `patch`, or `build` number may be omitted.
 *
 * NB: This implementation should be considered fit-for-purpose, and should be used sparing.
 */
class Version {
    /**
     * Build version number.
     */
    build;
    /**
     * Major version number.
     */
    major;
    /**
     * Minor version number.
     */
    minor;
    /**
     * Patch version number.
     */
    patch;
    /**
     * Initializes a new instance of the {@link Version} class.
     * @param value Value to parse the version from.
     */
    constructor(value) {
        const result = value.match(/^(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?$/);
        if (result === null) {
            throw new Error(`Invalid format; expected "{major}[.{minor}[.{patch}[.{build}]]]" but was "${value}"`);
        }
        [, this.major, this.minor, this.patch, this.build] = [...result.map((value) => parseInt(value) || 0)];
    }
    /**
     * Compares this instance to the {@link other} {@link Version}.
     * @param other The {@link Version} to compare to.
     * @returns `-1` when this instance is less than the {@link other}, `1` when this instance is greater than {@link other}, otherwise `0`.
     */
    compareTo(other) {
        const segments = ({ major, minor, build, patch }) => [major, minor, build, patch];
        const thisSegments = segments(this);
        const otherSegments = segments(other);
        for (let i = 0; i < 4; i++) {
            if (thisSegments[i] < otherSegments[i]) {
                return -1;
            }
            else if (thisSegments[i] > otherSegments[i]) {
                return 1;
            }
        }
        return 0;
    }
    /** @inheritdoc */
    toString() {
        return `${this.major}.${this.minor}`;
    }
}

/**
 * Provides a {@link LogTarget} that logs to the console.
 */
class ConsoleTarget {
    /**
     * @inheritdoc
     */
    write(entry) {
        switch (entry.level) {
            case "error":
                console.error(...entry.data);
                break;
            case "warn":
                console.warn(...entry.data);
                break;
            default:
                console.log(...entry.data);
        }
    }
}

// Remove any dependencies on node.
const EOL = "\n";
/**
 * Creates a new string log entry formatter.
 * @param opts Options that defines the type for the formatter.
 * @returns The string {@link LogEntryFormatter}.
 */
function stringFormatter(opts) {
    {
        return (entry) => {
            const { data, level, scope } = entry;
            let prefix = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} `;
            if (scope) {
                prefix += `${scope}: `;
            }
            return `${prefix}${reduce(data)}`;
        };
    }
}
/**
 * Stringifies the provided data parameters that make up the log entry.
 * @param data Data parameters.
 * @returns The data represented as a single `string`.
 */
function reduce(data) {
    let result = "";
    let previousWasError = false;
    for (const value of data) {
        // When the value is an error, write the stack.
        if (typeof value === "object" && value instanceof Error) {
            result += `${EOL}${value.stack}`;
            previousWasError = true;
            continue;
        }
        // When the previous was an error, write a new line.
        if (previousWasError) {
            result += EOL;
            previousWasError = false;
        }
        result += typeof value === "object" ? JSON.stringify(value) : value;
        result += " ";
    }
    return result.trimEnd();
}

/* eslint-disable @typescript-eslint/sort-type-constituents */
/**
 * Gets the priority of the specified log level as a number; low numbers signify a higher priority.
 * @param level Log level.
 * @returns The priority as a number.
 */
function defcon(level) {
    switch (level) {
        case "error":
            return 0;
        case "warn":
            return 1;
        case "info":
            return 2;
        case "debug":
            return 3;
        case "trace":
        default:
            return 4;
    }
}

/**
 * Logger capable of forwarding messages to a {@link LogTarget}.
 */
class Logger {
    /**
     * Backing field for the {@link Logger.level}.
     */
    #level;
    /**
     * Options that define the loggers behavior.
     */
    #options;
    /**
     * Scope associated with this {@link Logger}.
     */
    #scope;
    /**
     * Initializes a new instance of the {@link Logger} class.
     * @param opts Options that define the loggers behavior.
     */
    constructor(opts) {
        this.#options = { minimumLevel: "trace", ...opts };
        this.#scope = this.#options.scope === undefined || this.#options.scope.trim() === "" ? "" : this.#options.scope;
        if (typeof this.#options.level !== "function") {
            this.setLevel(this.#options.level);
        }
    }
    /**
     * Gets the {@link LogLevel}.
     * @returns The {@link LogLevel}.
     */
    get level() {
        if (this.#level !== undefined) {
            return this.#level;
        }
        return typeof this.#options.level === "function" ? this.#options.level() : this.#options.level;
    }
    /**
     * Creates a scoped logger with the given {@link scope}; logs created by scoped-loggers include their scope to enable their source to be easily identified.
     * @param scope Value that represents the scope of the new logger.
     * @returns The scoped logger, or this instance when {@link scope} is not defined.
     */
    createScope(scope) {
        scope = scope.trim();
        if (scope === "") {
            return this;
        }
        return new Logger({
            ...this.#options,
            level: () => this.level,
            scope: this.#options.scope ? `${this.#options.scope}->${scope}` : scope,
        });
    }
    /**
     * Writes the arguments as a debug log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    debug(...data) {
        return this.write({ level: "debug", data, scope: this.#scope });
    }
    /**
     * Writes the arguments as error log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    error(...data) {
        return this.write({ level: "error", data, scope: this.#scope });
    }
    /**
     * Writes the arguments as an info log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    info(...data) {
        return this.write({ level: "info", data, scope: this.#scope });
    }
    /**
     * Sets the log-level that determines which logs should be written. The specified level will be inherited by all scoped loggers unless they have log-level explicitly defined.
     * @param level The log-level that determines which logs should be written; when `undefined`, the level will be inherited from the parent logger, or default to the environment level.
     * @returns This instance for chaining.
     */
    setLevel(level) {
        if (level !== undefined && defcon(level) > defcon(this.#options.minimumLevel)) {
            this.#level = "info";
        }
        else {
            this.#level = level;
        }
        return this;
    }
    /**
     * Writes the arguments as a trace log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    trace(...data) {
        return this.write({ level: "trace", data, scope: this.#scope });
    }
    /**
     * Writes the arguments as a warning log entry.
     * @param data Message or data to log.
     * @returns This instance for chaining.
     */
    warn(...data) {
        return this.write({ level: "warn", data, scope: this.#scope });
    }
    /**
     * Writes the log entry.
     * @param entry Log entry to write.
     * @returns This instance for chaining.
     */
    write(entry) {
        if (defcon(entry.level) <= defcon(this.level)) {
            this.#options.targets.forEach((t) => t.write(entry));
        }
        return this;
    }
}

/**
 * Provides a {@link LogTarget} capable of logging to a local file system.
 */
class FileTarget {
    /**
     * File path where logs will be written.
     */
    #filePath;
    /**
     * Options that defines how logs should be written to the local file system.
     */
    #options;
    /**
     * Current size of the logs that have been written to the {@link FileTarget.#filePath}.
     */
    #size = 0;
    /**
     * Initializes a new instance of the {@link FileTarget} class.
     * @param options Options that defines how logs should be written to the local file system.
     */
    constructor(options) {
        this.#options = options;
        this.#filePath = this.getLogFilePath();
        this.reIndex();
    }
    /**
     * @inheritdoc
     */
    write(entry) {
        const fd = fs.openSync(this.#filePath, "a");
        try {
            const msg = this.#options.format(entry);
            fs.writeSync(fd, msg + "\n");
            this.#size += msg.length;
        }
        finally {
            fs.closeSync(fd);
        }
        if (this.#size >= this.#options.maxSize) {
            this.reIndex();
            this.#size = 0;
        }
    }
    /**
     * Gets the file path to an indexed log file.
     * @param index Optional index of the log file to be included as part of the file name.
     * @returns File path that represents the indexed log file.
     */
    getLogFilePath(index = 0) {
        return path.join(this.#options.dest, `${this.#options.fileName}.${index}.log`);
    }
    /**
     * Gets the log files associated with this file target, including past and present.
     * @returns Log file entries.
     */
    getLogFiles() {
        const regex = /^\.(\d+)\.log$/;
        return fs
            .readdirSync(this.#options.dest, { withFileTypes: true })
            .reduce((prev, entry) => {
            if (entry.isDirectory() || entry.name.indexOf(this.#options.fileName) < 0) {
                return prev;
            }
            const match = entry.name.substring(this.#options.fileName.length).match(regex);
            if (match?.length !== 2) {
                return prev;
            }
            prev.push({
                path: path.join(this.#options.dest, entry.name),
                index: parseInt(match[1]),
            });
            return prev;
        }, [])
            .sort(({ index: a }, { index: b }) => {
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }
    /**
     * Re-indexes the existing log files associated with this file target, removing old log files whose
     * index exceeds the `maxFileCount`, and renaming the remaining log files, leaving index "0" free
     * for a new log file.
     */
    reIndex() {
        // When the destination directory is new, create it, and return.
        if (!fs.existsSync(this.#options.dest)) {
            fs.mkdirSync(this.#options.dest, {
                recursive: true,
            });
            return;
        }
        const logFiles = this.getLogFiles();
        for (let i = logFiles.length - 1; i >= 0; i--) {
            const log = logFiles[i];
            if (i >= this.#options.maxFileCount - 1) {
                fs.rmSync(log.path);
            }
            else {
                fs.renameSync(log.path, this.getLogFilePath(i + 1));
            }
        }
    }
}

let __isDebugMode = undefined;
/**
 * Determines whether the current plugin is running in a debug environment; this is determined by the command-line arguments supplied to the plugin by Stream. Specifically, the result
 * is `true` when  either `--inspect`, `--inspect-brk` or `--inspect-port` are present as part of the processes' arguments.
 * @returns `true` when the plugin is running in debug mode; otherwise `false`.
 */
function isDebugMode() {
    if (__isDebugMode === undefined) {
        __isDebugMode = process.execArgv.some((arg) => {
            const name = arg.split("=")[0];
            return name === "--inspect" || name === "--inspect-brk" || name === "--inspect-port";
        });
    }
    return __isDebugMode;
}
/**
 * Gets the plugin's unique-identifier from the current working directory.
 * @returns The plugin's unique-identifier.
 */
function getPluginUUID() {
    const name = path.basename(process.cwd());
    const suffixIndex = name.lastIndexOf(".sdPlugin");
    return suffixIndex < 0 ? name : name.substring(0, suffixIndex);
}

// Log all entires to a log file.
const fileTarget = new FileTarget({
    dest: path.join(cwd(), "logs"),
    fileName: getPluginUUID(),
    format: stringFormatter(),
    maxFileCount: 10,
    maxSize: 50 * 1024 * 1024,
});
// Construct the log targets.
const targets = [fileTarget];
if (isDebugMode()) {
    targets.splice(0, 0, new ConsoleTarget());
}
/**
 * Logger responsible for capturing log messages.
 */
const logger = new Logger({
    level: isDebugMode() ? "debug" : "info",
    minimumLevel: isDebugMode() ? "trace" : "debug",
    targets,
});
process.once("uncaughtException", (err) => logger.error("Process encountered uncaught exception", err));

/**
 * Provides a connection between the plugin and the Stream Deck allowing for messages to be sent and received.
 */
class Connection extends EventEmitter {
    /**
     * Private backing field for {@link Connection.registrationParameters}.
     */
    _registrationParameters;
    /**
     * Private backing field for {@link Connection.version}.
     */
    _version;
    /**
     * Used to ensure {@link Connection.connect} is invoked as a singleton; `false` when a connection is occurring or established.
     */
    canConnect = true;
    /**
     * Underlying web socket connection.
     */
    connection = withResolvers();
    /**
     * Logger scoped to the connection.
     */
    logger = logger.createScope("Connection");
    /**
     * Underlying connection information provided to the plugin to establish a connection with Stream Deck.
     * @returns The registration parameters.
     */
    get registrationParameters() {
        return (this._registrationParameters ??= this.getRegistrationParameters());
    }
    /**
     * Version of Stream Deck this instance is connected to.
     * @returns The version.
     */
    get version() {
        return (this._version ??= new Version(this.registrationParameters.info.application.version));
    }
    /**
     * Establishes a connection with the Stream Deck, allowing for the plugin to send and receive messages.
     * @returns A promise that is resolved when a connection has been established.
     */
    async connect() {
        // Ensure we only establish a single connection.
        if (this.canConnect) {
            this.canConnect = false;
            const webSocket = new WebSocket(`ws://127.0.0.1:${this.registrationParameters.port}`);
            webSocket.onmessage = (ev) => this.tryEmit(ev);
            webSocket.onopen = () => {
                webSocket.send(JSON.stringify({
                    event: this.registrationParameters.registerEvent,
                    uuid: this.registrationParameters.pluginUUID,
                }));
                // Web socket established a connection with the Stream Deck and the plugin was registered.
                this.connection.resolve(webSocket);
                this.emit("connected", this.registrationParameters.info);
            };
        }
        await this.connection.promise;
    }
    /**
     * Sends the commands to the Stream Deck, once the connection has been established and registered.
     * @param command Command being sent.
     * @returns `Promise` resolved when the command is sent to Stream Deck.
     */
    async send(command) {
        const connection = await this.connection.promise;
        const message = JSON.stringify(command);
        this.logger.trace(message);
        connection.send(message);
    }
    /**
     * Gets the registration parameters, provided by Stream Deck, that provide information to the plugin, including how to establish a connection.
     * @returns Parsed registration parameters.
     */
    getRegistrationParameters() {
        const params = {
            port: undefined,
            info: undefined,
            pluginUUID: undefined,
            registerEvent: undefined,
        };
        const scopedLogger = logger.createScope("RegistrationParameters");
        for (let i = 0; i < process.argv.length - 1; i++) {
            const param = process.argv[i];
            const value = process.argv[++i];
            switch (param) {
                case RegistrationParameter.Port:
                    scopedLogger.debug(`port=${value}`);
                    params.port = value;
                    break;
                case RegistrationParameter.PluginUUID:
                    scopedLogger.debug(`pluginUUID=${value}`);
                    params.pluginUUID = value;
                    break;
                case RegistrationParameter.RegisterEvent:
                    scopedLogger.debug(`registerEvent=${value}`);
                    params.registerEvent = value;
                    break;
                case RegistrationParameter.Info:
                    scopedLogger.debug(`info=${value}`);
                    params.info = JSON.parse(value);
                    break;
                default:
                    i--;
                    break;
            }
        }
        const invalidArgs = [];
        const validate = (name, value) => {
            if (value === undefined) {
                invalidArgs.push(name);
            }
        };
        validate(RegistrationParameter.Port, params.port);
        validate(RegistrationParameter.PluginUUID, params.pluginUUID);
        validate(RegistrationParameter.RegisterEvent, params.registerEvent);
        validate(RegistrationParameter.Info, params.info);
        if (invalidArgs.length > 0) {
            throw new Error(`Unable to establish a connection with Stream Deck, missing command line arguments: ${invalidArgs.join(", ")}`);
        }
        return params;
    }
    /**
     * Attempts to emit the {@link ev} that was received from the {@link Connection.connection}.
     * @param ev Event message data received from Stream Deck.
     */
    tryEmit(ev) {
        try {
            const message = JSON.parse(ev.data.toString());
            if (message.event) {
                this.logger.trace(ev.data.toString());
                this.emit(message.event, message);
            }
            else {
                this.logger.warn(`Received unknown message: ${ev.data}`);
            }
        }
        catch (err) {
            this.logger.error(`Failed to parse message: ${ev.data}`, err);
        }
    }
}
const connection = new Connection();

/**
 * Provides information for events received from Stream Deck.
 */
class Event {
    /**
     * Event that occurred.
     */
    type;
    /**
     * Initializes a new instance of the {@link Event} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        this.type = source.event;
    }
}

/**
 * Provides information for an event relating to an action.
 */
class ActionWithoutPayloadEvent extends Event {
    action;
    /**
     * Initializes a new instance of the {@link ActionWithoutPayloadEvent} class.
     * @param action Action that raised the event.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(action, source) {
        super(source);
        this.action = action;
    }
}
/**
 * Provides information for an event relating to an action.
 */
class ActionEvent extends ActionWithoutPayloadEvent {
    /**
     * Provides additional information about the event that occurred, e.g. how many `ticks` the dial was rotated, the current `state` of the action, etc.
     */
    payload;
    /**
     * Initializes a new instance of the {@link ActionEvent} class.
     * @param action Action that raised the event.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(action, source) {
        super(action, source);
        this.payload = source.payload;
    }
}

const manifest$1 = new Lazy(() => {
    const path = join(process.cwd(), "manifest.json");
    if (!existsSync(path)) {
        throw new Error("Failed to read manifest.json as the file does not exist.");
    }
    try {
        return JSON.parse(readFileSync(path, {
            encoding: "utf-8",
            flag: "r",
        }).toString());
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            return null;
        }
        else {
            throw e;
        }
    }
});
const softwareMinimumVersion = new Lazy(() => {
    if (manifest$1.value === null) {
        return null;
    }
    return new Version(manifest$1.value.Software.MinimumVersion);
});
/**
 * Gets the SDK version that the plugin requires.
 * @returns SDK version; otherwise `null` when the plugin is DRM protected.
 */
function getSDKVersion() {
    return manifest$1.value?.SDKVersion ?? null;
}
/**
 * Gets the minimum version that the plugin requires.
 * @returns Minimum required version; otherwise `null` when the plugin is DRM protected.
 */
function getSoftwareMinimumVersion() {
    return softwareMinimumVersion.value;
}
/**
 * Gets the manifest associated with the plugin.
 * @returns The manifest; otherwise `null` when the plugin is DRM protected.
 */
function getManifest() {
    return manifest$1.value;
}

/**
 * Configuration shared by action components that must not depend on the plugin settings module.
 */
const actionConfig = {
    /**
     * Determines whether settings requests should use message identifiers and action settings cache behavior.
     */
    useExperimentalMessageIdentifiers: false,
};

const __items$1 = new Map();
/**
 * Provides a read-only store of Stream Deck devices.
 */
class ReadOnlyActionStore extends Enumerable {
    /**
     * Initializes a new instance of the {@link ReadOnlyActionStore}.
     */
    constructor() {
        super(__items$1);
    }
    /**
     * Gets the action with the specified identifier.
     * @param id Identifier of action to search for.
     * @returns The action, when present; otherwise `undefined`.
     */
    getActionById(id) {
        return __items$1.get(id);
    }
}
/**
 * Provides a store of Stream Deck actions.
 */
class ActionStore extends ReadOnlyActionStore {
    /**
     * Deletes the action from the store.
     * @param id The action's identifier.
     */
    delete(id) {
        __items$1.delete(id);
    }
    /**
     * Adds the action to the store.
     * @param action The action.
     */
    set(action) {
        __items$1.set(action.id, action);
    }
}
/**
 * Singleton instance of the action store.
 */
const actionStore = new ActionStore();

/**
 * Provides information for events relating to an application.
 */
class ApplicationEvent extends Event {
    /**
     * Monitored application that was launched/terminated.
     */
    application;
    /**
     * Initializes a new instance of the {@link ApplicationEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        super(source);
        this.application = source.payload.application;
    }
}

/**
 * Provides information for events relating to a device.
 */
class DeviceEvent extends Event {
    device;
    /**
     * Initializes a new instance of the {@link DeviceEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     * @param device Device that event is associated with.
     */
    constructor(source, device) {
        super(source);
        this.device = device;
    }
}

/**
 * Event information received from Stream Deck as part of a deep-link message being routed to the plugin.
 */
class DidReceiveDeepLinkEvent extends Event {
    /**
     * Deep-link URL routed from Stream Deck.
     */
    url;
    /**
     * Initializes a new instance of the {@link DidReceiveDeepLinkEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        super(source);
        this.url = new DeepLinkURL(source.payload.url);
    }
}
const PREFIX = "streamdeck://";
/**
 * Provides information associated with a URL received as part of a deep-link message, conforming to the URI syntax defined within RFC-3986 (https://datatracker.ietf.org/doc/html/rfc3986#section-3).
 */
class DeepLinkURL {
    /**
     * Fragment of the URL, with the number sign (#) omitted. For example, a URL of "/test#heading" would result in a {@link DeepLinkURL.fragment} of "heading".
     */
    fragment;
    /**
     * Original URL. For example, a URL of "/test?one=two#heading" would result in a {@link DeepLinkURL.href} of "/test?one=two#heading".
     */
    href;
    /**
     * Path of the URL; the full URL with the query and fragment omitted. For example, a URL of "/test?one=two#heading" would result in a {@link DeepLinkURL.path} of "/test".
     */
    path;
    /**
     * Query of the URL, with the question mark (?) omitted. For example, a URL of "/test?name=elgato&key=123" would result in a {@link DeepLinkURL.query} of "name=elgato&key=123".
     * See also {@link DeepLinkURL.queryParameters}.
     */
    query;
    /**
     * Query string parameters parsed from the URL. See also {@link DeepLinkURL.query}.
     */
    queryParameters;
    /**
     * Initializes a new instance of the {@link DeepLinkURL} class.
     * @param url URL of the deep-link, with the schema and authority omitted.
     */
    constructor(url) {
        const refUrl = new URL(`${PREFIX}${url}`);
        this.fragment = refUrl.hash.substring(1);
        this.href = refUrl.href.substring(PREFIX.length);
        this.path = DeepLinkURL.parsePath(this.href);
        this.query = refUrl.search.substring(1);
        this.queryParameters = refUrl.searchParams;
    }
    /**
     * Parses the {@link DeepLinkURL.path} from the specified {@link href}.
     * @param href Partial URL that contains the path to parse.
     * @returns The path of the URL.
     */
    static parsePath(href) {
        const indexOf = (char) => {
            const index = href.indexOf(char);
            return index >= 0 ? index : href.length;
        };
        return href.substring(0, Math.min(indexOf("?"), indexOf("#")));
    }
}

/**
 * Provides event information for when the plugin received the global settings.
 */
class DidReceiveGlobalSettingsEvent extends Event {
    /**
     * Settings associated with the event.
     */
    settings;
    /**
     * Initializes a new instance of the {@link DidReceiveGlobalSettingsEvent} class.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(source) {
        super(source);
        this.settings = source.payload.settings;
    }
}

/**
 * Provides information for an event triggered by a message being sent to the plugin, from the property inspector.
 */
class SendToPluginEvent extends Event {
    action;
    /**
     * Payload sent from the property inspector.
     */
    payload;
    /**
     * Initializes a new instance of the {@link SendToPluginEvent} class.
     * @param action Action that raised the event.
     * @param source Source of the event, i.e. the original message from Stream Deck.
     */
    constructor(action, source) {
        super(source);
        this.action = action;
        this.payload = source.payload;
    }
}

/**
 * Validates the `SDKVersion` within the manifest fulfils the minimum required version for the specified
 * feature; when the version is not fulfilled, an error is thrown with the feature formatted into the message.
 * @param minimumVersion Minimum required SDKVersion.
 * @param feature Feature that requires the version.
 */
function requiresSDKVersion(minimumVersion, feature) {
    const sdkVersion = getSDKVersion();
    if (sdkVersion !== null && minimumVersion > sdkVersion) {
        throw new Error(`[ERR_NOT_SUPPORTED]: ${feature} requires manifest SDK version ${minimumVersion} or higher, but found version ${sdkVersion}; please update the "SDKVersion" in the plugin's manifest to ${minimumVersion} or higher.`);
    }
}
/**
 * Validates the {@link streamDeckVersion} and manifest's `Software.MinimumVersion` are at least the {@link minimumVersion};
 * when the version is not fulfilled, an error is thrown with the {@link feature} formatted into the message.
 * @param minimumVersion Minimum required version.
 * @param streamDeckVersion Actual application version.
 * @param feature Feature that requires the version.
 */
function requiresVersion(minimumVersion, streamDeckVersion, feature) {
    const required = {
        major: Math.floor(minimumVersion),
        minor: Number(minimumVersion.toString().split(".").at(1) ?? 0), // Account for JavaScript's floating point precision.
        patch: 0,
        build: 0,
    };
    if (streamDeckVersion.compareTo(required) === -1) {
        throw new Error(`[ERR_NOT_SUPPORTED]: ${feature} requires Stream Deck version ${required.major}.${required.minor} or higher, but current version is ${streamDeckVersion.major}.${streamDeckVersion.minor}; please update Stream Deck and the "Software.MinimumVersion" in the plugin's manifest to "${required.major}.${required.minor}" or higher.`);
    }
    const softwareMinimumVersion = getSoftwareMinimumVersion();
    if (softwareMinimumVersion !== null && softwareMinimumVersion.compareTo(required) === -1) {
        throw new Error(`[ERR_NOT_SUPPORTED]: ${feature} requires Stream Deck version ${required.major}.${required.minor} or higher; please update the "Software.MinimumVersion" in the plugin's manifest to "${required.major}.${required.minor}" or higher.`);
    }
}

const settings = {
    /**
     * Available from Stream Deck 7.1; determines whether message identifiers should be sent when getting
     * action-instance or global settings.
     *
     * When `true`, the did-receive events associated with settings are only emitted when the action-instance
     * or global settings are changed in the property inspector.
     * @returns The value.
     */
    get useExperimentalMessageIdentifiers() {
        return actionConfig.useExperimentalMessageIdentifiers;
    },
    /**
     * Available from Stream Deck 7.1; determines whether message identifiers should be sent when getting
     * action-instance or global settings.
     *
     * When `true`, the did-receive events associated with settings are only emitted when the action-instance
     * or global settings are changed in the property inspector.
     */
    set useExperimentalMessageIdentifiers(value) {
        requiresVersion(7.1, connection.version, "Message identifiers");
        actionConfig.useExperimentalMessageIdentifiers = value;
    },
    /**
     * Gets the global settings associated with the plugin.
     * @template T The type of global settings associated with the plugin.
     * @returns Promise containing the plugin's global settings.
     */
    getGlobalSettings: () => {
        return new Promise((resolve) => {
            connection.once("didReceiveGlobalSettings", (ev) => resolve(ev.payload.settings));
            connection.send({
                event: "getGlobalSettings",
                context: connection.registrationParameters.pluginUUID,
                id: randomUUID(),
            });
        });
    },
    /**
     * Occurs when the global settings are requested, or when the the global settings were updated in
     * the property inspector.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that removes the listener.
     */
    onDidReceiveGlobalSettings: (listener) => {
        return connection.disposableOn("didReceiveGlobalSettings", (ev) => {
            // Do nothing when the global settings were requested.
            if (settings.useExperimentalMessageIdentifiers && ev.id) {
                return;
            }
            listener(new DidReceiveGlobalSettingsEvent(ev));
        });
    },
    /**
     * Occurs when the settings associated with an action instance are requested, or when the the settings
     * were updated in the property inspector.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that removes the listener.
     */
    onDidReceiveSettings: (listener) => {
        return connection.disposableOn("didReceiveSettings", (ev) => {
            // Do nothing when the action's settings were requested.
            if (settings.useExperimentalMessageIdentifiers && ev.id) {
                return;
            }
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    },
    /**
     * Sets the global settings associated the plugin; these settings are only available to this plugin,
     * and should be used to persist information securely.
     * @param settings Settings to save.
     * @example
     * streamDeck.settings.setGlobalSettings({
     *   apiKey,
     *   connectedDate: new Date()
     * })
     */
    setGlobalSettings: async (settings) => {
        await connection.send({
            event: "setGlobalSettings",
            context: connection.registrationParameters.pluginUUID,
            payload: settings,
        });
    },
};

/**
 * Controller capable of sending/receiving payloads with the property inspector, and listening for events.
 */
class UIController {
    /**
     * Action associated with the current property inspector.
     */
    #action;
    /**
     * To overcome event races, the debounce counter keeps track of appear vs disappear events, ensuring
     * we only clear the current ui when an equal number of matching disappear events occur.
     */
    #appearanceStackCount = 0;
    /**
     * Initializes a new instance of the {@link UIController} class.
     */
    constructor() {
        // Track the action for the current property inspector.
        this.onDidAppear((ev) => {
            if (this.#isCurrent(ev.action)) {
                this.#appearanceStackCount++;
            }
            else {
                this.#appearanceStackCount = 1;
                this.#action = ev.action;
            }
        });
        this.onDidDisappear((ev) => {
            if (this.#isCurrent(ev.action)) {
                this.#appearanceStackCount--;
                if (this.#appearanceStackCount <= 0) {
                    this.#action = undefined;
                }
            }
        });
    }
    /**
     * Gets the action associated with the current property.
     * @returns The action; otherwise `undefined` when a property inspector is not visible.
     */
    get action() {
        return this.#action;
    }
    /**
     * Occurs when the property inspector associated with the action becomes visible, i.e. the user
     * selected an action in the Stream Deck application..
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDidAppear(listener) {
        return connection.disposableOn("propertyInspectorDidAppear", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionWithoutPayloadEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the property inspector associated with the action disappears, i.e. the user unselected
     * the action in the Stream Deck application.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDidDisappear(listener) {
        return connection.disposableOn("propertyInspectorDidDisappear", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionWithoutPayloadEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when a message was sent to the plugin _from_ the property inspector.
     * @template TPayload The type of the payload received from the property inspector.
     * @template TSettings The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onSendToPlugin(listener) {
        return connection.disposableOn("sendToPlugin", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new SendToPluginEvent(action, ev));
            }
        });
    }
    /**
     * Sends the payload to the property inspector; the payload is only sent when the property inspector
     * is visible for an action provided by this plugin.
     * @param payload Payload to send.
     */
    async sendToPropertyInspector(payload) {
        if (this.#action) {
            await connection.send({
                event: "sendToPropertyInspector",
                context: this.#action.id,
                payload,
            });
        }
    }
    /**
     * Determines whether the specified action is the action for the current property inspector.
     * @param action Action to check against.
     * @returns `true` when the actions are the same.
     */
    #isCurrent(action) {
        return (this.#action?.id === action.id &&
            this.#action?.manifestId === action.manifestId &&
            this.#action?.device?.id === action.device.id);
    }
}
const ui = new UIController();

/**
 * Provides a cache for action settings, keyed by action instance identifier.
 */
class SettingsCache {
    /**
     * Underlying map of action ID to cached settings.
     */
    #entries = new Map();
    /**
     * Removes the cached settings for the specified action.
     * @param id Action instance identifier.
     */
    delete(id) {
        this.#entries.delete(id);
    }
    /**
     * Gets the cached settings for the specified action.
     * @param id Action instance identifier.
     * @returns The cached settings when present; otherwise `undefined`.
     */
    get(id) {
        const settings = this.#entries.get(id);
        return settings !== undefined ? structuredClone(settings) : undefined;
    }
    /**
     * Sets the cached settings for the specified action.
     * @param id Action instance identifier.
     * @param settings The settings to cache.
     */
    set(id, settings) {
        this.#entries.set(id, structuredClone(settings));
    }
}
/**
 * Singleton instance of the settings cache.
 */
const settingsCache = new SettingsCache();

const __items = new Map();
/**
 * Provides a read-only store of Stream Deck devices.
 */
class ReadOnlyDeviceStore extends Enumerable {
    /**
     * Initializes a new instance of the {@link ReadOnlyDeviceStore}.
     */
    constructor() {
        super(__items);
    }
    /**
     * Gets the Stream Deck {@link Device} associated with the specified {@link deviceId}.
     * @param deviceId Identifier of the Stream Deck device.
     * @returns The Stream Deck device information; otherwise `undefined` if a device with the {@link deviceId} does not exist.
     */
    getDeviceById(deviceId) {
        return __items.get(deviceId);
    }
}
/**
 * Provides a store of Stream Deck devices.
 */
class DeviceStore extends ReadOnlyDeviceStore {
    /**
     * Adds the device to the store.
     * @param device The device.
     */
    set(device) {
        __items.set(device.id, device);
    }
}
/**
 * Singleton instance of the device store.
 */
const deviceStore = new DeviceStore();

/**
 * Provides information about an instance of a Stream Deck action.
 */
class ActionContext {
    /**
     * Device the action is associated with.
     */
    #device;
    /**
     * Source of the action.
     */
    #source;
    /**
     * Initializes a new instance of the {@link ActionContext} class.
     * @param source Source of the action.
     */
    constructor(source) {
        this.#source = source;
        const device = deviceStore.getDeviceById(source.device);
        if (!device) {
            throw new Error(`Failed to initialize action; device ${source.device} not found`);
        }
        this.#device = device;
    }
    /**
     * Type of the action.
     * - `Keypad` is a key.
     * - `Encoder` is a dial and portion of the touch strip.
     * @returns Controller type.
     */
    get controllerType() {
        return this.#source.payload.controller;
    }
    /**
     * Stream Deck device the action is positioned on.
     * @returns Stream Deck device.
     */
    get device() {
        return this.#device;
    }
    /**
     * Action instance identifier.
     * @returns Identifier.
     */
    get id() {
        return this.#source.context;
    }
    /**
     * Manifest identifier (UUID) for this action type.
     * @returns Manifest identifier.
     */
    get manifestId() {
        return this.#source.action;
    }
    /**
     * Converts this instance to a serializable object.
     * @returns The serializable object.
     */
    toJSON() {
        return {
            controllerType: this.controllerType,
            device: this.device,
            id: this.id,
            manifestId: this.manifestId,
        };
    }
}

const REQUEST_TIMEOUT = 15 * 1000; // 15s
/**
 * Provides a contextualized instance of an {@link Action}, allowing for direct communication with the Stream Deck.
 * @template T The type of settings associated with the action.
 */
class Action extends ActionContext {
    /**
     * Gets the resources (files) associated with this action; these resources are embedded into the
     * action when it is exported, either individually, or as part of a profile.
     *
     * Available from Stream Deck 7.1.
     * @returns The resources.
     */
    async getResources() {
        requiresVersion(7.1, connection.version, "getResources");
        const res = await this.#fetch("getResources", "didReceiveResources");
        return res.payload.resources;
    }
    /**
     * Gets the settings associated this action instance.
     * @template U The type of settings associated with the action.D
     * @returns Promise containing the action instance's settings.
     */
    async getSettings() {
        if (actionConfig.useExperimentalMessageIdentifiers) {
            const cached = settingsCache.get(this.id);
            if (cached !== undefined) {
                logger.trace(JSON.stringify({
                    event: "getSettings",
                    context: this.id,
                    source: "cache",
                    settings: cached,
                }));
                return cached;
            }
        }
        const res = await this.#fetch("getSettings", "didReceiveSettings");
        return res.payload.settings;
    }
    /**
     * Determines whether this instance is a dial.
     * @returns `true` when this instance is a dial; otherwise `false`.
     */
    isDial() {
        return this.controllerType === "Encoder";
    }
    /**
     * Determines whether this instance is a key.
     * @returns `true` when this instance is a key; otherwise `false`.
     */
    isKey() {
        return this.controllerType === "Keypad";
    }
    /**
     * Sets the resources (files) associated with this action; these resources are embedded into the
     * action when it is exported, either individually, or as part of a profile.
     *
     * Available from Stream Deck 7.1.
     * @example
     * action.setResources({
     *   fileOne: "c:\\hello-world.txt",
     *   anotherFile: "c:\\icon.png"
     * });
     * @param resources The resources as a map of file paths.
     * @returns `Promise` resolved when the resources are saved to Stream Deck.
     */
    setResources(resources) {
        requiresVersion(7.1, connection.version, "setResources");
        return connection.send({
            event: "setResources",
            context: this.id,
            payload: resources,
        });
    }
    /**
     * Sets the settings associated with this action instance. Use in conjunction with {@link Action.getSettings}.
     * @param value Settings to persist.
     * @returns `Promise` resolved when the settings are sent to Stream Deck.
     */
    setSettings(value) {
        settingsCache.delete(this.id);
        return connection.send({
            event: "setSettings",
            context: this.id,
            payload: value,
        });
    }
    /**
     * Temporarily shows an alert (i.e. warning), in the form of an exclamation mark in a yellow triangle, on this action instance. Used to provide visual feedback when an action failed.
     * @returns `Promise` resolved when the request to show an alert has been sent to Stream Deck.
     */
    showAlert() {
        return connection.send({
            event: "showAlert",
            context: this.id,
        });
    }
    /**
     * Fetches information from Stream Deck by sending the command, and awaiting the event.
     * @param command Name of the event (command) to send.
     * @param event Name of the event to await.
     * @returns The payload from the received event.
     */
    async #fetch(command, event) {
        const { resolve, reject, promise } = withResolvers();
        // Set a timeout to prevent endless awaiting.
        const timeoutId = setTimeout(() => {
            listener.dispose();
            reject("The request timed out");
        }, REQUEST_TIMEOUT);
        // Listen for an event that can resolve the request.
        const listener = connection.disposableOn(event, (ev) => {
            // Make sure the received event is for this action.
            if (ev.context == this.id) {
                clearTimeout(timeoutId);
                listener.dispose();
                resolve(ev);
            }
        });
        // Send the request; specifying an id signifies its a request.
        await connection.send({
            event: command,
            context: this.id,
            id: randomUUID(),
        });
        return promise;
    }
}

/**
 * Provides a contextualized instance of a dial action.
 * @template T The type of settings associated with the action.
 */
class DialAction extends Action {
    /**
     * Private backing field for {@link DialAction.coordinates}.
     */
    #coordinates;
    /**
     * Initializes a new instance of the {@see DialAction} class.
     * @param source Source of the action.
     */
    constructor(source) {
        super(source);
        if (source.payload.controller !== "Encoder") {
            throw new Error("Unable to create DialAction; source event is not a Encoder");
        }
        this.#coordinates = Object.freeze(source.payload.coordinates);
    }
    /**
     * Coordinates of the dial.
     * @returns The coordinates.
     */
    get coordinates() {
        return this.#coordinates;
    }
    /**
     * Sets the feedback for the current layout associated with this action instance, allowing for the visual items to be updated. Layouts are a powerful way to provide dynamic information
     * to users, and can be assigned in the manifest, or dynamically via {@link Action.setFeedbackLayout}.
     *
     * The {@link feedback} payload defines which items within the layout will be updated, and are identified by their property name (defined as the `key` in the layout's definition).
     * The values can either by a complete new definition, a `string` for layout item types of `text` and `pixmap`, or a `number` for layout item types of `bar` and `gbar`.
     * @param feedback Object containing information about the layout items to be updated.
     * @returns `Promise` resolved when the request to set the {@link feedback} has been sent to Stream Deck.
     */
    setFeedback(feedback) {
        return connection.send({
            event: "setFeedback",
            context: this.id,
            payload: feedback,
        });
    }
    /**
     * Sets the layout associated with this action instance. The layout must be either a built-in layout identifier, or path to a local layout JSON file within the plugin's folder.
     * Use in conjunction with {@link Action.setFeedback} to update the layout's current items' settings.
     * @param layout Name of a pre-defined layout, or relative path to a custom one.
     * @returns `Promise` resolved when the new layout has been sent to Stream Deck.
     */
    setFeedbackLayout(layout) {
        return connection.send({
            event: "setFeedbackLayout",
            context: this.id,
            payload: {
                layout,
            },
        });
    }
    /**
     * Sets the {@link image} to be display for this action instance within Stream Deck app.
     *
     * NB: The image can only be set by the plugin when the the user has not specified a custom image.
     * @param image Image to display; this can be either a path to a local file within the plugin's folder, a base64 encoded `string` with the mime type declared (e.g. PNG, JPEG, etc.),
     * or an SVG `string`. When `undefined`, the image from the manifest will be used.
     * @returns `Promise` resolved when the request to set the {@link image} has been sent to Stream Deck.
     */
    setImage(image) {
        return connection.send({
            event: "setImage",
            context: this.id,
            payload: {
                image,
            },
        });
    }
    /**
     * Sets the {@link title} displayed for this action instance.
     *
     * NB: The title can only be set by the plugin when the the user has not specified a custom title.
     * @param title Title to display.
     * @returns `Promise` resolved when the request to set the {@link title} has been sent to Stream Deck.
     */
    setTitle(title) {
        return this.setFeedback({ title });
    }
    /**
     * Sets the trigger (interaction) {@link descriptions} associated with this action instance. Descriptions are shown within the Stream Deck application, and informs the user what
     * will happen when they interact with the action, e.g. rotate, touch, etc. When {@link descriptions} is `undefined`, the descriptions will be reset to the values provided as part
     * of the manifest.
     *
     * NB: Applies to encoders (dials / touchscreens) found on Stream Deck + devices.
     * @param descriptions Descriptions that detail the action's interaction.
     * @returns `Promise` resolved when the request to set the {@link descriptions} has been sent to Stream Deck.
     */
    setTriggerDescription(descriptions) {
        return connection.send({
            event: "setTriggerDescription",
            context: this.id,
            payload: descriptions || {},
        });
    }
    /**
     * @inheritdoc
     */
    toJSON() {
        return {
            ...super.toJSON(),
            coordinates: this.coordinates,
        };
    }
}

/**
 * Provides a contextualized instance of a key action.
 * @template T The type of settings associated with the action.
 */
class KeyAction extends Action {
    /**
     * Private backing field for {@link KeyAction.coordinates}.
     */
    #coordinates;
    /**
     * Source of the action.
     */
    #source;
    /**
     * Initializes a new instance of the {@see KeyAction} class.
     * @param source Source of the action.
     */
    constructor(source) {
        super(source);
        if (source.payload.controller !== "Keypad") {
            throw new Error("Unable to create KeyAction; source event is not a Keypad");
        }
        this.#coordinates = !source.payload.isInMultiAction ? Object.freeze(source.payload.coordinates) : undefined;
        this.#source = source;
    }
    /**
     * Coordinates of the key; otherwise `undefined` when the action is part of a multi-action.
     * @returns The coordinates.
     */
    get coordinates() {
        return this.#coordinates;
    }
    /**
     * Determines whether the key is part of a multi-action.
     * @returns `true` when in a multi-action; otherwise `false`.
     */
    isInMultiAction() {
        return this.#source.payload.isInMultiAction;
    }
    /**
     * Sets the {@link image} to be display for this action instance.
     *
     * NB: The image can only be set by the plugin when the the user has not specified a custom image.
     * @param image Image to display; this can be either a path to a local file within the plugin's folder, a base64 encoded `string` with the mime type declared (e.g. PNG, JPEG, etc.),
     * or an SVG `string`. When `undefined`, the image from the manifest will be used.
     * @param options Additional options that define where and how the image should be rendered.
     * @returns `Promise` resolved when the request to set the {@link image} has been sent to Stream Deck.
     */
    setImage(image, options) {
        return connection.send({
            event: "setImage",
            context: this.id,
            payload: {
                image,
                ...options,
            },
        });
    }
    /**
     * Sets the current {@link state} of this action instance; only applies to actions that have multiple states defined within the manifest.
     * @param state State to set; this be either 0, or 1.
     * @returns `Promise` resolved when the request to set the state of an action instance has been sent to Stream Deck.
     */
    setState(state) {
        return connection.send({
            event: "setState",
            context: this.id,
            payload: {
                state,
            },
        });
    }
    /**
     * Sets the {@link title} displayed for this action instance.
     *
     * NB: The title can only be set by the plugin when the the user has not specified a custom title.
     * @param title Title to display; when `undefined` the title within the manifest will be used.
     * @param options Additional options that define where and how the title should be rendered.
     * @returns `Promise` resolved when the request to set the {@link title} has been sent to Stream Deck.
     */
    setTitle(title, options) {
        return connection.send({
            event: "setTitle",
            context: this.id,
            payload: {
                title,
                ...options,
            },
        });
    }
    /**
     * Temporarily shows an "OK" (i.e. success), in the form of a check-mark in a green circle, on this action instance. Used to provide visual feedback when an action successfully
     * executed.
     * @returns `Promise` resolved when the request to show an "OK" has been sent to Stream Deck.
     */
    showOk() {
        return connection.send({
            event: "showOk",
            context: this.id,
        });
    }
    /**
     * @inheritdoc
     */
    toJSON() {
        return {
            ...super.toJSON(),
            coordinates: this.coordinates,
            isInMultiAction: this.isInMultiAction(),
        };
    }
}

const manifest = new Lazy(() => getManifest());
/**
 * Provides functions, and information, for interacting with Stream Deck actions.
 */
class ActionService extends ReadOnlyActionStore {
    /**
     * Initializes a new instance of the {@link ActionService} class.
     */
    constructor() {
        super();
        // Adds the action to the store.
        connection.prependListener("willAppear", (ev) => {
            const action = ev.payload.controller === "Encoder" ? new DialAction(ev) : new KeyAction(ev);
            actionStore.set(action);
            if (actionConfig.useExperimentalMessageIdentifiers) {
                settingsCache.set(ev.context, ev.payload.settings);
            }
        });
        // Update the settings cache when settings are received.
        connection.prependListener("didReceiveSettings", (ev) => {
            if (actionConfig.useExperimentalMessageIdentifiers) {
                settingsCache.set(ev.context, ev.payload.settings);
            }
        });
        // Remove the action from the store.
        connection.prependListener("willDisappear", (ev) => {
            actionStore.delete(ev.context);
            settingsCache.delete(ev.context);
        });
    }
    /**
     * Occurs when the user presses a dial (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDialDown(listener) {
        return connection.disposableOn("dialDown", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user rotates a dial (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDialRotate(listener) {
        return connection.disposableOn("dialRotate", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user releases a pressed dial (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDialUp(listener) {
        return connection.disposableOn("dialUp", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the resources were updated within the property inspector.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDidReceiveResources(listener) {
        return connection.disposableOn("didReceiveResources", (ev) => {
            // When the id is defined, the resources were requested, so we don't propagate the event.
            if (ev.id !== undefined) {
                return;
            }
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user presses a action down.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onKeyDown(listener) {
        return connection.disposableOn("keyDown", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isKey()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user releases a pressed action.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onKeyUp(listener) {
        return connection.disposableOn("keyUp", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isKey()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user updates an action's title settings in the Stream Deck application. See also {@link Action.setTitle}.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onTitleParametersDidChange(listener) {
        return connection.disposableOn("titleParametersDidChange", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when the user taps the touchscreen (Stream Deck +).
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onTouchTap(listener) {
        return connection.disposableOn("touchTap", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action?.isDial()) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when an action appears on the Stream Deck due to the user navigating to another page, profile, folder, etc. This also occurs during startup if the action is on the "front
     * page". An action refers to _all_ types of actions, e.g. keys, dials,
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onWillAppear(listener) {
        return connection.disposableOn("willAppear", (ev) => {
            const action = actionStore.getActionById(ev.context);
            if (action) {
                listener(new ActionEvent(action, ev));
            }
        });
    }
    /**
     * Occurs when an action disappears from the Stream Deck due to the user navigating to another page, profile, folder, etc. An action refers to _all_ types of actions, e.g. keys,
     * dials, touchscreens, pedals, etc.
     * @template T The type of settings associated with the action.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onWillDisappear(listener) {
        return connection.disposableOn("willDisappear", (ev) => listener(new ActionEvent(new ActionContext(ev), ev)));
    }
    /**
     * Registers the action with the Stream Deck, routing all events associated with the {@link SingletonAction.manifestId} to the specified {@link action}.
     * @param action The action to register.
     * @example
     * ＠action({ UUID: "com.elgato.test.action" })
     * class MyCustomAction extends SingletonAction {
     *     export function onKeyDown(ev: KeyDownEvent) {
     *         // Do some awesome thing.
     *     }
     * }
     *
     * streamDeck.actions.registerAction(new MyCustomAction());
     */
    registerAction(action) {
        if (action.manifestId === undefined) {
            throw new Error("The action's manifestId cannot be undefined.");
        }
        if (manifest.value !== null && !manifest.value.Actions.some((a) => a.UUID === action.manifestId)) {
            throw new Error(`The action's manifestId was not found within the manifest: ${action.manifestId}`);
        }
        // Routes an event to the action, when the applicable listener is defined on the action.
        const { manifestId } = action;
        const route = (fn, listener) => {
            const boundedListener = listener?.bind(action);
            if (boundedListener === undefined) {
                return;
            }
            fn.bind(action)(async (ev) => {
                if (ev.action.manifestId == manifestId) {
                    await boundedListener(ev);
                }
            });
        };
        // Route each of the action events.
        route(this.onDialDown, action.onDialDown);
        route(this.onDialUp, action.onDialUp);
        route(this.onDialRotate, action.onDialRotate);
        route(ui.onSendToPlugin, action.onSendToPlugin);
        route(this.onDidReceiveResources, action.onDidReceiveResources);
        route(settings.onDidReceiveSettings, action.onDidReceiveSettings);
        route(this.onKeyDown, action.onKeyDown);
        route(this.onKeyUp, action.onKeyUp);
        route(ui.onDidAppear, action.onPropertyInspectorDidAppear);
        route(ui.onDidDisappear, action.onPropertyInspectorDidDisappear);
        route(this.onTitleParametersDidChange, action.onTitleParametersDidChange);
        route(this.onTouchTap, action.onTouchTap);
        route(this.onWillAppear, action.onWillAppear);
        route(this.onWillDisappear, action.onWillDisappear);
    }
}
/**
 * Service for interacting with Stream Deck actions.
 */
const actionService = new ActionService();

/**
 * Provides information about a device.
 */
class Device {
    /**
     * Private backing field for {@link Device.isConnected}.
     */
    #isConnected = false;
    /**
     * Private backing field for the device's information.
     */
    #info;
    /**
     * Unique identifier of the device.
     */
    id;
    /**
     * Initializes a new instance of the {@link Device} class.
     * @param id Device identifier.
     * @param info Information about the device.
     * @param isConnected Determines whether the device is connected.
     */
    constructor(id, info, isConnected) {
        this.id = id;
        this.#info = info;
        this.#isConnected = isConnected;
        // Set connected.
        connection.prependListener("deviceDidConnect", (ev) => {
            if (ev.device === this.id) {
                this.#info = ev.deviceInfo;
                this.#isConnected = true;
            }
        });
        // Track changes.
        connection.prependListener("deviceDidChange", (ev) => {
            if (ev.device === this.id) {
                this.#info = ev.deviceInfo;
            }
        });
        // Set disconnected.
        connection.prependListener("deviceDidDisconnect", (ev) => {
            if (ev.device === this.id) {
                this.#isConnected = false;
            }
        });
    }
    /**
     * Actions currently visible on the device.
     * @returns Collection of visible actions.
     */
    get actions() {
        return actionStore.filter((a) => a.device.id === this.id);
    }
    /**
     * Determines whether the device is currently connected.
     * @returns `true` when the device is connected; otherwise `false`.
     */
    get isConnected() {
        return this.#isConnected;
    }
    /**
     * Name of the device, as specified by the user in the Stream Deck application.
     * @returns Name of the device.
     */
    get name() {
        return this.#info.name;
    }
    /**
     * Number of action slots, excluding dials / touchscreens, available to the device.
     * @returns Size of the device.
     */
    get size() {
        return this.#info.size;
    }
    /**
     * Type of the device that was connected, e.g. Stream Deck +, Stream Deck Pedal, etc. See {@link DeviceType}.
     * @returns Type of the device.
     */
    get type() {
        return this.#info.type;
    }
}

/**
 * Provides functions, and information, for interacting with Stream Deck actions.
 */
class DeviceService extends ReadOnlyDeviceStore {
    /**
     * Initializes a new instance of the {@link DeviceService}.
     */
    constructor() {
        super();
        // Add the devices from registration parameters.
        connection.once("connected", (info) => {
            info.devices.forEach((dev) => deviceStore.set(new Device(dev.id, dev, false)));
        });
        // Add new devices that were connected.
        connection.on("deviceDidConnect", ({ device: id, deviceInfo }) => {
            if (!deviceStore.getDeviceById(id)) {
                deviceStore.set(new Device(id, deviceInfo, true));
            }
        });
        // Add new devices that were changed (Virtual Stream Deck event race).
        connection.on("deviceDidChange", ({ device: id, deviceInfo }) => {
            if (!deviceStore.getDeviceById(id)) {
                deviceStore.set(new Device(id, deviceInfo, false));
            }
        });
    }
    /**
     * Occurs when a Stream Deck device changed, for example its name or size.
     *
     * Available from Stream Deck 7.0.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDeviceDidChange(listener) {
        requiresVersion(7.0, connection.version, "onDeviceDidChange");
        return connection.disposableOn("deviceDidChange", (ev) => listener(new DeviceEvent(ev, this.getDeviceById(ev.device))));
    }
    /**
     * Occurs when a Stream Deck device is connected. See also {@link DeviceService.onDeviceDidConnect}.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDeviceDidConnect(listener) {
        return connection.disposableOn("deviceDidConnect", (ev) => listener(new DeviceEvent(ev, this.getDeviceById(ev.device))));
    }
    /**
     * Occurs when a Stream Deck device is disconnected. See also {@link DeviceService.onDeviceDidDisconnect}.
     * @param listener Function to be invoked when the event occurs.
     * @returns A disposable that, when disposed, removes the listener.
     */
    onDeviceDidDisconnect(listener) {
        return connection.disposableOn("deviceDidDisconnect", (ev) => listener(new DeviceEvent(ev, this.getDeviceById(ev.device))));
    }
}
/**
 * Provides functions, and information, for interacting with Stream Deck actions.
 */
const deviceService = new DeviceService();

/**
 * Loads a locale from the file system.
 * @param language Language to load.
 * @returns Contents of the locale.
 */
function fileSystemLocaleProvider(language) {
    const filePath = path.join(process.cwd(), `${language}.json`);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        // Parse the translations from the file.
        const contents = fs.readFileSync(filePath, { flag: "r" })?.toString();
        return parseLocalizations(contents);
    }
    catch (err) {
        logger.error(`Failed to load translations from ${filePath}`, err);
        return null;
    }
}
/**
 * Parses the localizations from the specified contents, or throws a `TypeError` when unsuccessful.
 * @param contents Contents that represent the stringified JSON containing the localizations.
 * @returns The localizations; otherwise a `TypeError`.
 */
function parseLocalizations(contents) {
    const json = JSON.parse(contents);
    if (json !== undefined && json !== null && typeof json === "object" && "Localization" in json) {
        return json["Localization"];
    }
    throw new TypeError(`Translations must be a JSON object nested under a property named "Localization"`);
}

/**
 * Requests the Stream Deck switches the current profile of the specified {@link deviceId} to the {@link profile}; when no {@link profile} is provided the previously active profile
 * is activated.
 *
 * NB: Plugins may only switch to profiles distributed with the plugin, as defined within the manifest, and cannot access user-defined profiles.
 * @param deviceId Unique identifier of the device where the profile should be set.
 * @param profile Optional name of the profile to switch to; when `undefined` the previous profile will be activated. Name must be identical to the one provided in the manifest.
 * @param page Optional page to show when switching to the {@link profile}, indexed from 0. When `undefined`, the page that was previously visible (when switching away from the
 * profile) will be made visible.
 * @returns `Promise` resolved when the request to switch the `profile` has been sent to Stream Deck.
 */
function switchToProfile(deviceId, profile, page) {
    if (page !== undefined) {
        requiresVersion(6.5, connection.version, "Switching to a profile page");
    }
    return connection.send({
        event: "switchToProfile",
        context: connection.registrationParameters.pluginUUID,
        device: deviceId,
        payload: {
            page,
            profile,
        },
    });
}

var profiles = /*#__PURE__*/Object.freeze({
    __proto__: null,
    switchToProfile: switchToProfile
});

/**
 * Occurs when a monitored application is launched. Monitored applications can be defined in the manifest via the {@link Manifest.ApplicationsToMonitor} property.
 * See also {@link onApplicationDidTerminate}.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onApplicationDidLaunch(listener) {
    return connection.disposableOn("applicationDidLaunch", (ev) => listener(new ApplicationEvent(ev)));
}
/**
 * Occurs when a monitored application terminates. Monitored applications can be defined in the manifest via the {@link Manifest.ApplicationsToMonitor} property.
 * See also {@link onApplicationDidLaunch}.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onApplicationDidTerminate(listener) {
    return connection.disposableOn("applicationDidTerminate", (ev) => listener(new ApplicationEvent(ev)));
}
/**
 * Occurs when a deep-link message is routed to the plugin from Stream Deck. One-way deep-link messages can be sent to plugins from external applications using the URL format
 * `streamdeck://plugins/message/<PLUGIN_UUID>/{MESSAGE}`.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onDidReceiveDeepLink(listener) {
    requiresVersion(6.5, connection.version, "Receiving deep-link messages");
    return connection.disposableOn("didReceiveDeepLink", (ev) => listener(new DidReceiveDeepLinkEvent(ev)));
}
/**
 * Occurs when the computer wakes up.
 * @param listener Function to be invoked when the event occurs.
 * @returns A disposable that, when disposed, removes the listener.
 */
function onSystemDidWakeUp(listener) {
    return connection.disposableOn("systemDidWakeUp", (ev) => listener(new Event(ev)));
}
/**
 * Opens the specified `url` in the user's default browser.
 * @param url URL to open.
 * @returns `Promise` resolved when the request to open the `url` has been sent to Stream Deck.
 */
function openUrl(url) {
    return connection.send({
        event: "openUrl",
        payload: {
            url,
        },
    });
}
/**
 * Gets the secrets associated with the plugin.
 * @returns `Promise` resolved with the secrets associated with the plugin.
 */
function getSecrets() {
    requiresVersion(6.9, connection.version, "Secrets");
    requiresSDKVersion(3, "Secrets");
    return new Promise((resolve) => {
        connection.once("didReceiveSecrets", (ev) => resolve(ev.payload.secrets));
        connection.send({
            event: "getSecrets",
            context: connection.registrationParameters.pluginUUID,
        });
    });
}

var system = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getSecrets: getSecrets,
    onApplicationDidLaunch: onApplicationDidLaunch,
    onApplicationDidTerminate: onApplicationDidTerminate,
    onDidReceiveDeepLink: onDidReceiveDeepLink,
    onSystemDidWakeUp: onSystemDidWakeUp,
    openUrl: openUrl
});

/**
 * Defines a Stream Deck action associated with the plugin.
 * @param definition The definition of the action, e.g. it's identifier, name, etc.
 * @returns The definition decorator.
 */
function action(definition) {
    const manifestId = definition.UUID;
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
    return function (target, context) {
        return class extends target {
            /**
             * The universally-unique value that identifies the action within the manifest.
             */
            manifestId = manifestId;
        };
    };
}

/**
 * Provides the main bridge between the plugin and the Stream Deck allowing the plugin to send requests and receive events, e.g. when the user presses an action.
 * @template T The type of settings associated with the action.
 */
class SingletonAction {
    /**
     * The universally-unique value that identifies the action within the manifest.
     */
    manifestId;
    /**
     * Gets the visible actions with the `manifestId` that match this instance's.
     * @returns The visible actions.
     */
    get actions() {
        return actionStore.filter((a) => a.manifestId === this.manifestId);
    }
}

let i18n;
const streamDeck = {
    /**
     * Namespace for event listeners and functionality relating to Stream Deck actions.
     * @returns Actions namespace.
     */
    get actions() {
        return actionService;
    },
    /**
     * Namespace for interacting with Stream Deck devices.
     * @returns Devices namespace.
     */
    get devices() {
        return deviceService;
    },
    /**
     * Internalization provider, responsible for managing localizations and translating resources.
     * @returns Internalization provider.
     */
    get i18n() {
        return (i18n ??= new I18nProvider(this.info.application.language, fileSystemLocaleProvider));
    },
    /**
     * Registration and application information provided by Stream Deck during initialization.
     * @returns Registration information.
     */
    get info() {
        return connection.registrationParameters.info;
    },
    /**
     * Logger responsible for capturing log messages.
     * @returns The logger.
     */
    get logger() {
        return logger;
    },
    /**
     * Namespace for Stream Deck profiles.
     * @returns Profiles namespace.
     */
    get profiles() {
        return profiles;
    },
    /**
     * Namespace for persisting settings within Stream Deck.
     * @returns Settings namespace.
     */
    get settings() {
        return settings;
    },
    /**
     * Namespace for interacting with, and receiving events from, the system the plugin is running on.
     * @returns System namespace.
     */
    get system() {
        return system;
    },
    /**
     * Namespace for interacting with UI (property inspector) associated with the plugin.
     * @returns UI namespace.
     */
    get ui() {
        return ui;
    },
    /**
     * Connects the plugin to the Stream Deck.
     * @returns A promise resolved when a connection has been established.
     */
    connect() {
        return connection.connect();
    },
};

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
}
function __runInitializers(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
}
typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

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
// --- Per-channel parameters: /{bus}/{channel}/{param} -------------------------
/** Any single-level channel parameter, e.g. channel(\"output\", 2, \"faderlin\"). */
const channel = (bus, ch, param) => `/${bus}/${ch}/${param}`;
const channelFaderlin = (bus, ch) => channel(bus, ch, "faderlin");
const channelMute = (bus, ch) => channel(bus, ch, "mute");
const channelName = (bus, ch) => channel(bus, ch, "name");
/**
 * Preamp gain in dB; the table leaves the unit unspecified. L/R-split: on a
 * stereo pair the right side is addressed at channel + 1.
 */
const channelGain = (ch) => channel("input", ch, "gain");
const channelStereo = (bus, ch) => channel(bus, ch, "stereo");
// --- Mix nodes: /mix/{in|pb}/{input}/{output}/{param} -------------------------
const mixNode = (src, input, output, param) => `/mix/${src}/${input}/${output}/${param}`;
const mixFaderlin = (src, input, output) => mixNode(src, input, output, "faderlin");
const mixSolo = (src, input, output) => mixNode(src, input, output, "solo");
// --- Control room: /controlroom/{param} ---------------------------------------
const controlroom = (param) => `/controlroom/${param}`;
const CR_DIM = controlroom("dim");
/**
 * Output channel the Control Room's Main Out is assigned to, in 0-based channel
 * numbering (value 0.0 = channel 1+2). Main out volume is that output channel's
 * fader; Global OSC has no separate mastervolume address.
 */
const CR_MAINOUT = controlroom("mainout");
const CR_MAIN_MONO = controlroom("mainmono");
const CR_TALKBACK = controlroom("talkback");
const CR_EXTERNAL_IN = controlroom("externalin");
const CR_SPEAKER_B = controlroom("speakerb");
const CR_MUTE_FX = controlroom("mutefx");
const CR_LINK_AB = controlroom("linkab");
const CR_RECALL = controlroom("recall");
// --- FX: /reverb/{param}, /echo/{param} ---------------------------------------
const reverb = (param) => `/reverb/${param}`;
const echo = (param) => `/echo/${param}`;
const REVERB_ENABLE$1 = reverb("enable");
const ECHO_ENABLE$1 = echo("enable");
// --- Top-level ----------------------------------------------------------------
const GLOBAL_MUTE$1 = "/globalmute";
const GLOBAL_SOLO$1 = "/globalsolo";
const UNDO = "/undo";
const REDO = "/redo";
/** f-typed, not (f): 1 shows the TotalMix window, 0 hides it. */
const SHOW_WINDOW = "/showwindow";
// --- Groups, snapshots, layouts (all numbered from 1) -------------------------
/** Receive-only in this protocol: TotalMix never reports group state back. */
const muteGroup$1 = (n) => `/mutegroup/${n}`;
const soloGroup$1 = (n) => `/sologroup/${n}`;
const faderGroup$1 = (n) => `/fadergroup/${n}`;
/**
 * Send 1.0 to load. TotalMix reports state on the same address:
 * 0 = off, 2 = active, 3 = changed.
 */
const snapshotLoad = (n) => `/snapshot/load/${n}`;
const layoutLoad = (n) => `/layout/load/${n}`;
// --- DURec: /durec/{command} --------------------------------------------------
const durec = (command) => `/durec/${command}`;
const DUREC_PLAY = durec("play");
const DUREC_PAUSE = durec("pause");
/** Per the table: during recording, stop must be sent twice — or with a value > 10. */
const DUREC_STOP = durec("stop");
const DUREC_RECORD = durec("record");
const DUREC_NEXT = durec("next");
const DUREC_PREVIOUS = durec("previous");
/** Send-only strings: "Not ready", "Stop", "Record", "Play", "Pause". */
const DUREC_STATE = durec("state");
const DUREC_TIME = durec("time");
// --- Refresh triggers ---------------------------------------------------------
/** (f): triggers a send of ALL parameters; value 2 limits mix nodes to fader > -65 dB. */
const SEND_ALL = "/sendall";
const SEND_STATE = "/sendstate";
const sendChan = (bus, ch) => `/sendchan/${bus}/${ch}`;
/** f-typed: 1 triggers all of one submix's nodes, 2 only those with fader > -65 dB. */
const sendSubmix = (out) => `/sendsubmix/${out}`;
/** Peak level [dB]; TotalMix sends only changing values. */
const level = (bus, ch) => `/level/${bus}/${ch}`;
const levelBusOf = (bus) => bus === "input" ? "in" : bus === "playback" ? "pb" : "out";
// --- Status (send-only) -------------------------------------------------------
const STATUS_DEVICE = "/status/device";
const STATUS_CONNECTION = "/status/connection";
const STATUS_DSP = "/status/dsp";

/**
 * Minimal OSC 1.0 codec covering the subset TotalMix FX uses: bundles of
 * single-argument messages carrying a float or a string.
 *
 * Wire format: big-endian; strings null-terminated and padded with nulls to a
 * 4-byte boundary. Correctness is covered by tests including a captured session.
 */
const MAX_BUNDLE_DEPTH = 8;
const BUNDLE_TAG = "#bundle\0";
const pad4 = (n) => (n + 3) & -4;
/** TotalMix sends a bare "/" as a keepalive. */
const isHeartbeat = (m) => m.address === "/";
/**
 * Numeric view of a value. TotalMix expresses on/off as 0.0/1.0, so booleans
 * coerce. Strings do not: a display string such as "-6.0 dB" is formatting, not
 * a value, and parsing it would mask a mis-modelled address.
 */
function asNumber(v) {
    if (typeof v === "number")
        return v;
    if (typeof v === "boolean")
        return v ? 1 : 0;
    return 0;
}
/** TotalMix treats anything at or above 0.5 as on. */
const asBool = (v) => typeof v === "string" ? false : asNumber(v) >= 0.5;
/**
 * Reads a null-terminated, 4-byte-padded OSC string, advancing past the padding.
 * Returns null when the buffer holds no terminator (malformed).
 */
function readString(buf, c) {
    if (c.pos >= buf.length)
        return null;
    const nul = buf.indexOf(0, c.pos);
    if (nul < 0)
        return null;
    const s = buf.toString("utf8", c.pos, nul);
    const advance = pad4(nul - c.pos + 1);
    // Padding running past the datagram: keeps the string and parks the cursor at
    // the end so no further argument is read.
    c.pos = c.pos + advance > buf.length ? buf.length : c.pos + advance;
    return s;
}
/**
 * Reads one argument by type tag. Returns `undefined` when the argument cannot
 * be read or its width is unknown; alignment is unrecoverable at that point and
 * the caller must stop.
 */
function readArg(buf, c, tag) {
    switch (tag) {
        case "f":
            if (c.pos + 4 > buf.length)
                return undefined;
            {
                const v = buf.readFloatBE(c.pos);
                c.pos += 4;
                return v;
            }
        case "i":
            if (c.pos + 4 > buf.length)
                return undefined;
            {
                const v = buf.readInt32BE(c.pos);
                c.pos += 4;
                return v;
            }
        case "s":
        case "S":
            return readString(buf, c) ?? undefined;
        case "T":
            return true;
        case "F":
            return false;
        case "b": {
            // Blob: int32 length, payload padded to 4. Unused by TotalMix; skipped
            // so any following argument stays aligned.
            if (c.pos + 4 > buf.length)
                return undefined;
            const len = buf.readInt32BE(c.pos);
            c.pos += 4;
            if (len < 0 || c.pos + pad4(len) > buf.length)
                return undefined;
            c.pos += pad4(len);
            return null;
        }
        // Fixed-width types that are unused but must be stepped over.
        case "h":
        case "d":
        case "t":
            if (c.pos + 8 > buf.length)
                return undefined;
            c.pos += 8;
            return null;
        case "c":
        case "r":
        case "m":
            if (c.pos + 4 > buf.length)
                return undefined;
            c.pos += 4;
            return null;
        // Zero-width types.
        case "N":
        case "I":
            return null;
        default:
            return undefined;
    }
}
function parseMessage(buf, out) {
    const c = { pos: 0 };
    const address = readString(buf, c);
    if (address === null)
        return;
    // No type tag string: an argument-less signal. The "/" heartbeat arrives
    // this way.
    if (c.pos >= buf.length) {
        out.push({ address, value: null, argCount: 0 });
        return;
    }
    const tags = readString(buf, c);
    if (tags === null || tags[0] !== ",")
        return;
    let value = null;
    let argCount = 0;
    for (let i = 1; i < tags.length; i++) {
        const v = readArg(buf, c, tags[i]);
        // Unparseable argument: the address alone is often actionable, so the
        // message is kept.
        if (v === undefined)
            break;
        if (argCount === 0)
            value = v;
        argCount++;
    }
    out.push({ address, value, argCount });
}
function parseInto(buf, out, depth) {
    if (depth > MAX_BUNDLE_DEPTH || buf.length < 4)
        return;
    if (buf.length >= 8 && buf.toString("latin1", 0, 8) === BUNDLE_TAG) {
        // 8 bytes "#bundle\0" + 8 byte timetag. The timetag is ignored; TotalMix
        // sends immediate bundles.
        let pos = 16;
        while (pos + 4 <= buf.length) {
            const size = buf.readInt32BE(pos);
            pos += 4;
            // Guard against a negative or oversized length claiming more than the
            // datagram holds — the classic malformed-packet read overrun.
            if (size <= 0 || pos + size > buf.length)
                return;
            parseInto(buf.subarray(pos, pos + size), out, depth + 1);
            pos += size;
        }
        return;
    }
    if (buf[0] !== 0x2f /* '/' */)
        return;
    parseMessage(buf, out);
}
/**
 * Parses one UDP datagram into a flat list of messages (bundles flattened).
 *
 * Never throws. A truncated or corrupt datagram yields whatever was parsed before
 * the damage and then stops
 */
function parsePacket(buf) {
    const out = [];
    try {
        parseInto(buf, out, 0);
    }
    catch {
        // Defensive: the code above is bounds-checked, but a listener must never
        // die on input it did not expect.
    }
    return out;
}
function writeString(s) {
    const raw = Buffer.from(s, "utf8");
    const buf = Buffer.alloc(pad4(raw.length + 1));
    raw.copy(buf, 0);
    return buf;
}
/**
 * Builds a single message with one float argument — the only form TotalMix needs
 * for faders, toggles and navigation.
 */
function encodeFloat(address, value) {
    const addr = writeString(address);
    const tags = writeString(",f");
    const arg = Buffer.alloc(4);
    arg.writeFloatBE(value, 0);
    return Buffer.concat([addr, tags, arg]);
}
function encodeInt(address, value) {
    const addr = writeString(address);
    const tags = writeString(",i");
    const arg = Buffer.alloc(4);
    arg.writeInt32BE(value, 0);
    return Buffer.concat([addr, tags, arg]);
}

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
const FALLBACK_GAIN_DB = 65;
const DEVICES = [
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
];
/** Escapes regex metacharacters that appear in model names ("UFX+", "M-1610"). */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
/**
 * Fragment matchers, ordered longest first and anchored to word boundaries.
 *
 * Length ordering prevents "ucx" matching "Fireface UCX II". Boundary anchoring
 * prevents "fireface uc" — the longer fragment — matching it either, while still
 * allowing "ufx+" and "12mic-d".
 */
const MATCHERS = DEVICES.flatMap((device) => device.match.map((fragment) => ({ fragment, device })))
    .sort((a, b) => b.fragment.length - a.fragment.length)
    .map(({ fragment, device }) => ({
    pattern: new RegExp(`(?<![a-z0-9])${escape(fragment)}(?![a-z0-9])`),
    device,
}));
/** Resolves a /status/device string to a known device by fragment match. */
function matchDevice(name) {
    const haystack = name.toLowerCase();
    return MATCHERS.find((m) => m.pattern.test(haystack))?.device;
}
/** Looks up a device by the id stored in an action's settings. */
const deviceById = (id) => DEVICES.find((d) => d.id === id);
/**
 * Last device reported by /status/device on any Global OSC connection.
 * Undefined when no Global OSC connection has reported one.
 */
let detected;
let lastUnknown;
/** Records a name from /status/device. Unrecognised names are logged once each. */
function rememberDevice(name, warn) {
    const trimmed = name.trim();
    if (trimmed === "")
        return;
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
const detectedDevice = () => detected;
/**
 * Gain span for a classic gain dial: the configured device, or the fallback.
 *
 * Detection is not consulted. The device name exists only on the Global OSC
 * slot, so using it here would make dial travel depend on whether an unrelated
 * controller slot is connected.
 */
function gainRangeDb(settingId) {
    if (settingId !== undefined && settingId !== "") {
        const picked = deviceById(settingId);
        if (picked !== undefined)
            return picked.gainDb;
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
function detectedMaxGainDb(fallback) {
    return detectedDevice()?.gainDb ?? fallback;
}

/**
 * TotalMix's factory settings for the Global OSC slot. The second port pair;
 * slot 1 (7001/9001) carries the classic protocol, and both can be in use at
 * once.
 */
const DEFAULT_GLOBAL_OPTIONS = {
    host: "127.0.0.1",
    sendPort: 7002,
    receivePort: 9002,
};
const DEFAULT_TIMING$1 = { staleMs: 5000, refreshMs: 2000 };
/** Outbound flush interval: one send per address per tick. */
const SEND_COALESCE_MS$1 = 25;
class GlobalConnection {
    socket = null;
    options = DEFAULT_GLOBAL_OPTIONS;
    /** Absolute address -> last known value. No views, so one flat map suffices. */
    cache = new Map();
    /** Address -> subscribers. Actions are woken only for what they asked for. */
    listeners = new Map();
    /** Connection up/down subscribers, separate from per-address listeners. */
    connectionListeners = new Set();
    /** Pending outbound values, flushed on a timer so dials cannot flood the wire. */
    pending = new Map();
    flushTimer = null;
    refreshTimer = null;
    /** Timestamp of the last inbound packet, the basis of the staleness check. */
    lastInbound = 0;
    connectedFlag = false;
    /** Guards the one-shot "first inbound" diagnostic in handlePacket. */
    loggedFirstInbound = false;
    /**
     * True once non-heartbeat state has arrived. While false, the refresh timer
     * re-sends /sendall, covering a request sent before TotalMix was listening.
     */
    primed = false;
    timing;
    constructor(timing = {}) {
        this.timing = { ...DEFAULT_TIMING$1, ...timing };
    }
    /** True while inbound OSC is arriving; see setConnected for the transitions. */
    get connected() {
        return this.connectedFlag;
    }
    /**
     * The resolved host and ports, after the string coercion connect() applies.
     * Trailing underscore avoids colliding with the private `options` field.
     */
    get options_() {
        return this.options;
    }
    /** Opens the socket, or reopens it if the receive port changed. Idempotent. */
    async connect(options = {}) {
        const next = {
            host: options.host !== undefined ? String(options.host) : this.options.host,
            sendPort: options.sendPort !== undefined ? Number(options.sendPort) : this.options.sendPort,
            receivePort: options.receivePort !== undefined ? Number(options.receivePort) : this.options.receivePort,
        };
        if (!Number.isFinite(next.sendPort) || !Number.isFinite(next.receivePort)) {
            streamDeck.logger.error(`Global OSC: ignoring invalid ports (send=${String(options.sendPort)}, receive=${String(options.receivePort)})`);
            return;
        }
        const portChanged = this.socket !== null && next.receivePort !== this.options.receivePort;
        this.options = next;
        if (this.socket !== null && !portChanged)
            return;
        if (portChanged)
            this.closeSocket();
        await this.openSocket();
        this.startRefreshTimer();
        this.requestFullRefresh();
    }
    /**
     * Binds the receive port. Resolves on "listening", and also on a bind
     * failure, so connect() settles either way.
     */
    openSocket() {
        return new Promise((resolve) => {
            // No reuseAddr: on UDP it permits two sockets on one port, with only
            // one of them receiving traffic. Without it, a receive port shared
            // with the classic slot raises EADDRINUSE in the error handler below.
            const socket = dgram.createSocket({ type: "udp4" });
            socket.on("message", (buf) => this.handlePacket(buf));
            socket.on("error", (err) => {
                const inUse = err.code === "EADDRINUSE";
                streamDeck.logger.error(inUse
                    ? `Global OSC: udp/${this.options.receivePort} is already in use — ` +
                        `check that the classic and Global OSC slots use different receive ports.`
                    : `Global OSC socket error: ${err.message}`);
                this.setConnected(false);
                this.closeSocket();
                // Bind failures arrive on this event rather than as a synchronous
                // throw, so the promise is settled here as well.
                resolve();
            });
            socket.on("listening", () => {
                streamDeck.logger.info(`Global OSC: listening on udp/${this.options.receivePort}, ` +
                    `sending to ${this.options.host}:${this.options.sendPort}`);
                resolve();
            });
            try {
                socket.bind(this.options.receivePort);
                this.socket = socket;
            }
            catch (err) {
                streamDeck.logger.error(`Global OSC: could not bind udp/${this.options.receivePort}: ${err}`);
                resolve();
            }
        });
    }
    /**
     * Entry point for every inbound datagram: refreshes the liveness clock, then
     * files each message into the flat cache. A malformed packet parses to no
     * messages and is dropped.
     */
    handlePacket(buf) {
        const messages = parsePacket(buf);
        if (messages.length === 0)
            return;
        const now = Date.now();
        const resumedAfterGap = this.lastInbound !== 0 && now - this.lastInbound > this.timing.staleMs;
        const hasData = messages.some((m) => !isHeartbeat(m));
        if (hasData) {
            this.primed = true;
        }
        if (resumedAfterGap) {
            // Overrides the flag set above: after a gap longer than staleMs the
            // rest of TotalMix's state is unknown, so a single message does not
            // count as a primed cache. Note the difference from the classic
            // connection, where the two branches are exclusive.
            this.primed = false;
            this.requestFullRefresh();
        }
        if (!this.loggedFirstInbound) {
            this.loggedFirstInbound = true;
            const sample = messages.slice(0, 8).map((m) => m.address).join(", ");
            streamDeck.logger.info(`Global OSC: first inbound, ${messages.length} message(s). Sample: ${sample}`);
        }
        this.lastInbound = now;
        this.setConnected(true);
        for (const m of messages) {
            if (isHeartbeat(m))
                continue;
            const previous = this.cache.get(m.address);
            if (previous === m.value)
                continue;
            // Applied changes are logged: the initial dump as a one-off
            // inventory, then one line per change TotalMix transmits.
            // /level/… and /status/dsp are excluded — both change many times a
            // second while audio plays, at a volume that would fill the log.
            if (!m.address.startsWith("/level/") && m.address !== STATUS_DSP) {
                streamDeck.logger.info(`Global OSC inbound: ${m.address} = ${String(m.value)}`);
            }
            this.cache.set(m.address, m.value);
            // /status/device is the only source of the device name; the classic
            // protocol carries no device identifier.
            if (m.address === STATUS_DEVICE && typeof m.value === "string") {
                rememberDevice(m.value, (msg) => streamDeck.logger.warn(msg));
            }
            this.notify(m.address, m.value);
        }
    }
    /**
     * Wakes an address's subscribers. A throwing listener is logged and skipped
     * so one misbehaving action cannot stop the others being updated.
     */
    notify(address, value) {
        const subs = this.listeners.get(address);
        if (subs === undefined)
            return;
        for (const fn of subs) {
            try {
                fn(value);
            }
            catch (err) {
                streamDeck.logger.error(`Global OSC listener for ${address} threw: ${err}`);
            }
        }
    }
    /**
     * Last known value for an absolute address, or undefined if never received.
     * Addresses name a hardware channel, so a single cached value applies
     * everywhere and no view parameter is needed.
     */
    get(address) {
        return this.cache.get(address);
    }
    /**
     * Numeric read. Booleans collapse to 1/0 because TotalMix sends some on/off
     * parameters as OSC booleans and others as floats for the same concept.
     */
    getNumber(address, fallback = 0) {
        const v = this.cache.get(address);
        return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
    }
    /**
     * String read, for the status block and DURec strings. Returns undefined
     * for a non-string value rather than coercing, leaving the fallback to the
     * caller.
     */
    getString(address) {
        const v = this.cache.get(address);
        return typeof v === "string" ? v : undefined;
    }
    /** All cached addresses matching a regex — used by the PI channel datasource. */
    addresses(pattern) {
        const out = [];
        for (const key of this.cache.keys()) {
            if (pattern.test(key))
                out.push(key);
        }
        return out;
    }
    /**
     * Subscribes to an address. Returns an unsubscribe function, to be called
     * from the action's onWillDisappear; otherwise listeners accumulate as
     * profiles switch.
     *
     * Any cached value is delivered on a microtask, so a button that has just
     * appeared renders without waiting for the next change.
     */
    subscribe(address, listener) {
        let subs = this.listeners.get(address);
        if (subs === undefined) {
            subs = new Set();
            this.listeners.set(address, subs);
        }
        subs.add(listener);
        const cached = this.cache.get(address);
        if (cached !== undefined) {
            queueMicrotask(() => listener(cached));
        }
        return () => {
            const set = this.listeners.get(address);
            if (set === undefined)
                return;
            set.delete(listener);
            if (set.size === 0)
                this.listeners.delete(address);
        };
    }
    /**
     * Subscribes to connection up/down. Fires immediately with the current
     * state, so a button appearing on a dead connection renders its placeholder
     * without waiting for the next transition. Returns an unsubscribe.
     */
    onConnectionChange(listener) {
        this.connectionListeners.add(listener);
        listener(this.connectedFlag);
        return () => this.connectionListeners.delete(listener);
    }
    /** Notifies on transitions only, so idle traffic does not re-render every key. */
    setConnected(connected) {
        if (this.connectedFlag === connected)
            return;
        this.connectedFlag = connected;
        for (const fn of this.connectionListeners) {
            try {
                fn(connected);
            }
            catch {
                /* ignore */
            }
        }
    }
    /**
     * Sets a stateful parameter. Caches optimistically (see the class comment)
     * and wakes subscribers, so a toggle's state updates without an echo from
     * TotalMix.
     */
    set(address, value) {
        streamDeck.logger.info(`Global OSC out (set): ${address} = ${value}`);
        const previous = this.cache.get(address);
        this.cache.set(address, value);
        if (previous !== value)
            this.notify(address, value);
        this.sendBuffer(encodeFloat(address, Number(value)));
    }
    /**
     * Fires an (f)-typed command. Not cached: on addresses like
     * /snapshot/load/N the inbound direction carries TotalMix's 0/2/3 state
     * signalling, which an outgoing 1.0 would overwrite.
     */
    trigger(address, value = 1.0) {
        streamDeck.logger.info(`Global OSC out (trigger): ${address} = ${value}`);
        this.sendBuffer(encodeFloat(address, Number(value)));
    }
    /**
     * Reads the cached state of a stateful on/off parameter and sets its
     * inverse. With nothing cached, the first press sets it on. For the
     * receive-only group addresses (/mutegroup/N and siblings), which TotalMix
     * does not report, the optimistic cache holds the state, so alternating
     * presses alternate the group.
     */
    toggleSet(address) {
        const current = this.getNumber(address, 0);
        this.set(address, current >= 0.5 ? 0 : 1);
    }
    /** Coalesced continuous write for dial rotation; optimistically cached. */
    setCoalesced(address, value) {
        this.pending.set(address, value);
        this.cache.set(address, value);
        if (this.flushTimer !== null)
            return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            const batch = [...this.pending];
            this.pending.clear();
            for (const [addr, v] of batch) {
                streamDeck.logger.info(`Global OSC out (dial): ${addr} = ${v.toFixed(4)}`);
                this.sendBuffer(encodeFloat(addr, v));
            }
        }, SEND_COALESCE_MS$1);
    }
    /**
     * The single outbound path for this class.
     *
     * send() can throw synchronously, e.g. on a socket caught mid-close. The
     * throw is contained and logged here rather than propagating into the key
     * handler.
     */
    sendBuffer(buf) {
        const socket = this.socket;
        if (socket === null) {
            streamDeck.logger.warn("Global OSC send skipped: socket not open");
            return;
        }
        try {
            socket.send(buf, this.options.sendPort, this.options.host, (err) => {
                if (err)
                    streamDeck.logger.error(`Global OSC send failed: ${err.message}`);
            });
        }
        catch (err) {
            streamDeck.logger.error(`Global OSC send threw: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    /**
     * /sendall 1.0 asks TotalMix to re-send every parameter.
     *
     * /sendall covers the mix and channel nodes but not the status block: device
     * name, connection flag, DSP load and the DURec strings sit behind
     * /sendstate. Once triggered, status is pushed at about one parameter per
     * second; repeating the trigger recovers from a dropped datagram.
     */
    requestFullRefresh() {
        this.trigger(SEND_ALL, 1.0);
        this.trigger(SEND_STATE, 1.0);
    }
    /**
     * Watchdog: re-requests state when the link has gone silent, and repeats the
     * request while no state has arrived, covering a first /sendall sent before
     * TotalMix was listening. Once primed and receiving, neither branch runs.
     */
    startRefreshTimer() {
        if (this.refreshTimer !== null)
            return;
        this.refreshTimer = setInterval(() => {
            const silent = Date.now() - this.lastInbound;
            if (silent > this.timing.staleMs) {
                if (this.connectedFlag) {
                    streamDeck.logger.warn(`Global OSC: nothing from TotalMix for ${Math.round(silent / 1000)}s — re-requesting.`);
                }
                this.setConnected(false);
                this.requestFullRefresh();
            }
            else if (!this.primed) {
                this.requestFullRefresh();
            }
        }, this.timing.refreshMs);
        this.refreshTimer.unref?.();
    }
    /**
     * Closes and forgets the socket. Tolerates an already-closed socket, which
     * happens when the error handler and an explicit close race.
     */
    closeSocket() {
        if (this.socket === null)
            return;
        try {
            this.socket.close();
        }
        catch {
            /* already closed */
        }
        this.socket = null;
    }
    /** Releases everything. Called on plugin shutdown. */
    dispose() {
        if (this.flushTimer !== null)
            clearTimeout(this.flushTimer);
        if (this.refreshTimer !== null)
            clearInterval(this.refreshTimer);
        this.flushTimer = null;
        this.refreshTimer = null;
        this.listeners.clear();
        this.connectionListeners.clear();
        this.cache.clear();
        this.closeSocket();
    }
}
/**
 * Pool, keyed by host and port pair: one connection per Global OSC controller
 * slot, shared by every action configured for it. Separate from the classic
 * pool, so a global action on 7002/9002 and a classic action on 7001/9001 hold
 * independent sockets.
 */
const pool$1 = new Map();
/**
 * The connection for a host and port pair, created on first use. Actions call
 * this on every event rather than holding a reference, so a settings change
 * moves them to the right slot without any teardown of their own.
 */
function globalMixFor(options) {
    const key = `${options.host}:${options.sendPort}:${options.receivePort}`;
    let conn = pool$1.get(key);
    if (conn === undefined) {
        conn = new GlobalConnection();
        pool$1.set(key, conn);
    }
    void conn.connect(options);
    return conn;
}
/** Releases every pooled Global OSC connection. Called on plugin shutdown. */
function disposeAllGlobal() {
    for (const conn of pool$1.values()) {
        conn.dispose();
    }
    pool$1.clear();
}

/**
 * Property-inspector values arrive as strings.
 *
 * sdpi-textfield and sdpi-range persist what the DOM gives them, so a port typed
 * as 9001 is stored as "9001" and a slider position as "3". The action settings
 * types declare `number`, which is not what arrives. Every numeric setting is
 * coerced here at the point of use.
 *
 * This is not cosmetic. A string port makes `connect()` believe the port changed
 * on every action appearance ("9001" !== 9001), tearing down and reopening the
 * shared socket each time — and a send racing a mid-close socket throws, killing
 * the key press silently.
 */
function num(v, fallback) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
    }
    return fallback;
}
function str(v, fallback) {
    return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
}
function connectionOptions(s) {
    return {
        host: str(s.host, "127.0.0.1"),
        sendPort: num(s.sendPort, 7001),
        receivePort: num(s.receivePort, 9001),
    };
}

/**
 * Connection settings for global actions. Same shape as the classic helper but
 * with the Global OSC slot's defaults (TotalMix Remote Controller 2: 7002/9002),
 * so classic and global buttons coexist on separate sockets out of the box.
 */
function globalConnectionOptions(s) {
    return {
        host: str(s.host, "127.0.0.1"),
        sendPort: num(s.sendPort, 7002),
        receivePort: num(s.receivePort, 9002),
    };
}
/** Channels to list when TotalMix has not (yet) told us anything. */
const FALLBACK_CHANNEL_COUNT = 24;
/**
 * Builds the channel dropdown for a bus from what TotalMix actually sent after
 * /sendall: names from /{bus}/{n}/name, stereo-ness from /{bus}/{n}/stereo.
 *
 * Values are the 0-based wire channel numbers the protocol wants; labels show
 * the 1-based numbers users see in TotalMix (the table's own example reads
 * "/output/2/faderlin sets fader of output 2 (channel 3)").
 *
 * Stereo pairs are addressed by their left number, so right halves are hidden —
 * except when includeRightHalves is set (for the L/R-split parameters phase and
 * gain, where right = left + 1 is a real, separately addressable target).
 */
function buildChannelItems(gm, bus, includeRightHalves) {
    const namePattern = new RegExp(`^/${bus}/(\\d+)/name$`);
    let maxChannel = -1;
    for (const address of gm.addresses(namePattern)) {
        const m = namePattern.exec(address);
        if (m)
            maxChannel = Math.max(maxChannel, Number(m[1]));
    }
    if (maxChannel < 0)
        maxChannel = FALLBACK_CHANNEL_COUNT - 1;
    const items = [];
    for (let n = 0; n <= maxChannel; n++) {
        const name = gm.getString(channelName(bus, n));
        const stereo = asBool(gm.get(channelStereo(bus, n)) ?? 0);
        items.push({ value: String(n), label: name ? `${n + 1} · ${name}` : `${n + 1}` });
        if (stereo) {
            if (includeRightHalves) {
                items.push({ value: String(n + 1), label: name ? `${n + 2} · ${name} (R)` : `${n + 2} (R)` });
            }
            // The pair's right half occupies the next number; skip it so the loop
            // doesn't list it a second time as an unnamed mono channel.
            n++;
        }
    }
    return items;
}
/**
 * Same datasource plumbing as the classic actions: the PI sends { event }, the
 * plugin replies
 * { event, items }. The connection is primed via /sendall on connect; the short
 * wait lets a just-opened socket's dump land before the list is built.
 */
async function replyGlobalChannelDatasource(gm, event, bus, includeRightHalves) {
    await new Promise((r) => setTimeout(r, 250));
    const items = buildChannelItems(gm, bus, includeRightHalves);
    const named = items.filter((i) => i.label.includes("·")).length;
    streamDeck.logger.info(`Global datasource reply (${event}, ${bus}): ${items.length} channels, ${named} named`);
    await streamDeck.ui.sendToPropertyInspector({ event, items });
}

/**
 * Address construction for TotalMix FX, following RME's OSC table (1.96).
 *
 * The addressing is control-element oriented, not channel oriented: "/1/volume3"
 * means "the third fader of whatever bank is currently shown", not "channel 3".
 * Bank position is moved with /setBankStart, and the bus (input/playback/output)
 * with the bus* addresses. Everything here is a thin, typed wrapper over that.
 */
/** Faders per bank on page 1. RME's default is 8; configurable in TotalMix. */
// --- Page-independent, receive-only direct selectors -------------------------
// These are the reason submix and channel selection does not need Mackie-style
// record-enable navigation.
/** Selects a submix directly by index (0 .. submixCount-1). */
const SET_SUBMIX = "/setSubmix";
/** Selects a channel directly (0 .. channelCount-1); becomes the bank start on page 1. */
const SET_BANK_START = "/setBankStart";
/** Sets the page-2 channel relative to the bank start, counted in faders. */
const SET_OFFSET_IN_BANK = "/setOffsetInBank";
/** Loads a configured Quick Workspace (1..30). */
const LOAD_QUICK_WORKSPACE = "/loadQuickWorkspace";
// --- Page 1: mixer -----------------------------------------------------------
const bus = (b) => b === "input" ? "/1/busInput" : b === "playback" ? "/1/busPlayback" : "/1/busOutput";
/** Fader for the nth strip in the current bank (1-based, as RME numbers them). */
const volume = (strip) => `/1/volume${strip}`;
/** Per-strip mute. RME's grid addressing: /1/mute/1/<strip>. */
const mute = (strip) => `/1/mute/1/${strip}`;
const solo = (strip) => `/1/solo/1/${strip}`;
const phantom = (strip) => `/1/phantom/1/${strip}`;
const cue = (strip) => `/1/cue/1/${strip}`;
const trackName = (strip) => `/1/trackname${strip}`;
/**
 * Preamp/digital input gain for a strip. Input bus only; the scale is device- and
 * channel-dependent (kOSCScaleLin01 over whatever range the preamp has), so the
 * ...Val string from TotalMix is the only trustworthy display. On stereo channels
 * TotalMix applies it to both sides.
 */
const micGain = (strip) => `/1/micgain${strip}`;
const LABEL_SUBMIX = "/1/labelSubmix";
// Main / control room.
// NB: RME's name really is "mastervolume" — /1/mainVolume does not exist and
// TotalMix silently ignores unknown addresses. Verified against the 1.96 table.
const MAIN_VOLUME = "/1/mastervolume";
const MAIN_DIM = "/1/mainDim";
const MAIN_MONO = "/1/mainMono";
const MAIN_RECALL = "/1/mainRecall";
const MAIN_MUTE_FX = "/1/mainMuteFx";
const MAIN_EXT_IN = "/1/mainExtIn";
const MAIN_TALKBACK = "/1/mainTalkback";
const MAIN_SPEAKER_B = "/1/mainSpeakerB";
const GLOBAL_MUTE = "/1/globalMute";
const GLOBAL_SOLO = "/1/globalSolo";
const TRIM = "/1/trim";
// Bank navigation.
const TRACK_NEXT = "/1/track+";
const TRACK_PREV = "/1/track-";
const BANK_NEXT = "/1/bank+";
const BANK_PREV = "/1/bank-";
// --- Page 2: selected channel ------------------------------------------------
const CH_VOLUME = "/2/volume";
const CH_MUTE = "/2/mute";
const CH_SOLO = "/2/solo";
const CH_PHANTOM = "/2/phantom";
const CH_EQ_ENABLE = "/2/eqEnable";
const CH_LOWCUT_ENABLE = "/2/lowcutEnable";
const CH_COMP_ENABLE = "/2/compexpEnable";
const CH_REVERB_SEND = "/2/reverbSend";
const CH_TRACK_NAME = "/2/trackname";
// --- Page 3: groups, snapshots, DuRec ----------------------------------------
/**
 * Mute/solo/fader group enables. Note the inversion in RME's addressing: group 1
 * is at index 4 and group 4 at index 1. This trips everyone up; the helpers below
 * take a human group number (1-4) and do the flip.
 */
const groupIndex = (group) => 5 - group;
const muteGroup = (group) => `/3/muteGroups/${groupIndex(group)}/1`;
const soloGroup = (group) => `/3/soloGroups/${groupIndex(group)}/1`;
const faderGroup = (group) => `/3/faderGroups/${groupIndex(group)}/1`;
/**
 * Page an address belongs to.
 *
 * A remote controller slot mirrors one page at a time and TotalMix transmits
 * only the selected page's parameters. Derived from the address rather than a
 * parallel table.
 */
function pageOf(address) {
    const m = /^\/([1-4])\//.exec(address);
    return m === null ? 1 : Number(m[1]);
}
/** Snapshots are similarly reversed: snapshot 1 is at index 8. */
const snapshot = (n) => `/3/snapshots/${9 - n}/1`;
// Continuous FX parameters (all kOSCScaleLin01 unless noted; Freq = log curve).
const REVERB_VOLUME = "/3/reverbVolume";
const REVERB_TIME = "/3/reverbTime";
const REVERB_PREDELAY = "/3/reverbPredelay";
const REVERB_WIDTH = "/3/reverbWidth";
const ECHO_VOLUME = "/3/echoVolume";
const ECHO_DELAY = "/3/echoDelaytime";
const ECHO_FEEDBACK = "/3/echoFeedback";
const CH_REVERB_RETURN = "/2/reverbReturn";
const CH_LOWCUT_FREQ = "/2/lowcutFreq"; // kOSCScaleFreq
const REVERB_ENABLE = "/3/reverbEnable";
const ECHO_ENABLE = "/3/echoEnable";
// --- Page 4: Room EQ (page selection forces the Output bus) -------------------
/** Room EQ enable for the selected output channel. */
const ROOM_EQ_ENABLE = "/4/reqEnable";
/** The display-string mirror TotalMix sends for a parameter, e.g. "/2/volumeVal". */
const displayOf = (address) => `${address}Val`;

/**
 * Supplies the property inspector's strip dropdown with real channel names.
 *
 * sdpi-components' datasource protocol: the PI sends { event: "<name>" } via
 * sendToPlugin, and expects { event: "<name>", items: [{ value, label }] } back.
 * Answered with the tracknames TotalMix mirrors for the visible bank, so the
 * user picks "3 · Phones" instead of guessing that Phones is fader 3.
 *
 * If the action pins a bus/bank, that view is asserted first and given a moment
 * to arrive, so the listed names match what the button will actually control.
 * Strips TotalMix hasn't named (or beyond the mirrored bank) fall back to plain
 * numbers — the dropdown is never worse than the slider it replaces.
 */
/**
 * Extracts the datasource event name from whatever shape the PI sent. sdpi's
 * exact payload framing has varied ("getStrips" bare, { event }, or nested), and
 * a mismatch here silently kills the dropdown, so accept all of them.
 */
function datasourceEvent(payload) {
    if (typeof payload === "string")
        return payload;
    if (payload && typeof payload === "object") {
        const p = payload;
        if (typeof p.event === "string")
            return p.event;
        if (p.payload && typeof p.payload.event === "string")
            return p.payload.event;
    }
    return undefined;
}
async function replyStripDatasource(tm, event, settings, forceInputBus) {
    const bus$1 = forceInputBus ? "input" : settings.bus;
    if (bus$1 === "input" || bus$1 === "playback" || bus$1 === "output") {
        tm.toggle(bus(bus$1));
    }
    if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
        tm.send(SET_BANK_START, num(settings.bankStart, 0));
    }
    // Give the page re-send triggered by the pin a moment to land in the cache.
    await new Promise((r) => setTimeout(r, 250));
    const items = [];
    for (let i = 1; i <= 24; i++) {
        const name = tm.getString(trackName(i));
        items.push({ value: String(i), label: name ? `${i} · ${name}` : `Strip ${i}` });
    }
    const named = items.filter((i) => i.label.includes("·")).length;
    streamDeck.logger.info(`Datasource reply: ${items.length} strips, ${named} with names`);
    await streamDeck.ui.sendToPropertyInspector({ event, items });
}

/**
 * Factory values, used when no default is set. These match TotalMix's
 * out-of-the-box Remote Controller ports.
 */
const BUILT_IN = {
    classic: { host: "127.0.0.1", sendPort: 7001, receivePort: 9001 },
    global: { host: "127.0.0.1", sendPort: 7002, receivePort: 9002 },
    stepDb: 1.5,
};
/**
 * Cached read of the global settings blob. Holds the in-flight promise rather
 * than its result, so buttons appearing together share one websocket round trip.
 */
let cache = null;
/** Whether the invalidation listener has been attached. */
let subscribed = false;
/**
 * Replaces the cache whenever Stream Deck pushes global settings, which it does
 * both in reply to a get and whenever the property inspector saves.
 */
function subscribe() {
    if (subscribed)
        return;
    subscribed = true;
    try {
        // The SDK generic requires JsonObject, which needs an index signature.
        // StoredDefaults has none, so the blob is read untyped and narrowed here.
        streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
            cache = Promise.resolve((ev.settings ?? {}));
        });
    }
    catch {
        // Without the event the cache lives until the plugin restarts.
    }
}
/** Reads the stored defaults, from cache where possible. */
async function storedDefaults() {
    subscribe();
    if (cache === null) {
        cache = streamDeck.settings
            .getGlobalSettings()
            .then((s) => s)
            .catch((err) => {
            // A cached failure would pin every later button to the built-ins.
            cache = null;
            streamDeck.logger.warn(`Could not read global defaults: ${String(err)}`);
            return {};
        });
    }
    return cache;
}
/** Resolves the defaults for one slot, applying built-ins where unset. */
async function getDefaults(slot) {
    const stored = await storedDefaults();
    const base = BUILT_IN[slot];
    return slot === "global"
        ? {
            host: str(stored.defaultGlobalHost, base.host),
            sendPort: num(stored.defaultGlobalSendPort, base.sendPort),
            receivePort: num(stored.defaultGlobalReceivePort, base.receivePort),
            stepDb: num(stored.defaultStepDb, BUILT_IN.stepDb),
        }
        : {
            host: str(stored.defaultHost, base.host),
            sendPort: num(stored.defaultSendPort, base.sendPort),
            receivePort: num(stored.defaultReceivePort, base.receivePort),
            stepDb: num(stored.defaultStepDb, BUILT_IN.stepDb),
        };
}
/**
 * Fills a button's absent connection fields from the stored defaults.
 *
 * `target` is mutated in place so the caller can use the seeded values in the
 * same pass rather than re-reading them and racing the write.
 *
 * Only `undefined` fields are set. An empty string is a cleared field and is
 * left alone, which also makes seeding idempotent across appearances.
 *
 * @returns Whether anything was written.
 */
async function seedDefaults(action, target, slot, opts = {}) {
    // Action settings interfaces have no index signature, so widen once here.
    const settings = target;
    const missing = settings.host === undefined ||
        settings.sendPort === undefined ||
        settings.receivePort === undefined ||
        (opts.stepDb === true && settings.stepDb === undefined);
    // An existing button reappearing: no websocket round trip needed.
    if (!missing)
        return false;
    const defaults = await getDefaults(slot);
    if (settings.host === undefined)
        settings.host = defaults.host;
    if (settings.sendPort === undefined)
        settings.sendPort = defaults.sendPort;
    if (settings.receivePort === undefined)
        settings.receivePort = defaults.receivePort;
    if (opts.stepDb === true && settings.stepDb === undefined)
        settings.stepDb = defaults.stepDb;
    await action.setSettings(settings);
    return true;
}

/**
 * Line-wraps a key title so long texts (device names, DURec state strings)
 * render across lines instead of being cut off at the key's edge.
 *
 * Stream Deck keys fit roughly 9-10 characters per line at the default title
 * size and up to three lines are comfortably readable. Words are kept whole
 * where possible; a word longer than a line is hard-split. Text beyond the
 * last line is ended with an ellipsis rather than silently dropped.
 */
function wrapTitle(text, maxChars = 9, maxLines = 3) {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let current = "";
    const push = () => {
        if (current !== "") {
            lines.push(current);
            current = "";
        }
    };
    for (let word of words) {
        while (word.length > maxChars) {
            push();
            lines.push(word.slice(0, maxChars));
            word = word.slice(maxChars);
        }
        if (current === "") {
            current = word;
        }
        else if (current.length + 1 + word.length <= maxChars) {
            current += ` ${word}`;
        }
        else {
            push();
            current = word;
        }
    }
    push();
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        const last = kept[maxLines - 1] ?? "";
        kept[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1))}…`;
        return kept.join("\n");
    }
    return lines.join("\n");
}

/**
 * Peak meters can update many times a second even with TotalMix's send-side
 * change detection; the Stream Deck does not need repainting faster than this.
 */
const LEVEL_RENDER_MS = 100;
/** Meter bar span: -60 dB at empty, 0 dBFS at full. */
const METER_FLOOR_DB = -60;
/**
 * Read-only display of values the Global OSC protocol publishes without a
 * corresponding control: peak level meters (/level/…, dB, only changing values
 * sent), the status block (/status/device | connection | dsp, sent about once
 * per second), and the DURec time and state strings.
 *
 * A press requests /sendstate, the refresh trigger for all status messages
 * including DURec, plus a full refresh.
 */
let GlobalDisplay = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.globaldisplay" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        cleanup = new Map();
        /** Per-action render throttle for the fast-moving level mode. */
        lastRender = new Map();
        renderTimers = new Map();
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "global");
            await this.setup(ev.action, ev.payload.settings);
        }
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        async setup(target, settings) {
            const gm = globalMixFor(globalConnectionOptions(settings));
            const mode = settings.mode ?? "level";
            const address = this.addressFor(settings);
            const render = () => {
                if (mode !== "level") {
                    void this.render(gm, target, settings);
                    return;
                }
                // Throttled path: paint at most every LEVEL_RENDER_MS, with one
                // trailing paint so the meter always settles on the latest value.
                const now = Date.now();
                const last = this.lastRender.get(target.id) ?? 0;
                if (now - last >= LEVEL_RENDER_MS) {
                    this.lastRender.set(target.id, now);
                    void this.render(gm, target, settings);
                    return;
                }
                if (this.renderTimers.has(target.id))
                    return;
                this.renderTimers.set(target.id, setTimeout(() => {
                    this.renderTimers.delete(target.id);
                    this.lastRender.set(target.id, Date.now());
                    void this.render(gm, target, settings);
                }, LEVEL_RENDER_MS - (now - last)));
            };
            // Keys draw the value as the title; a blank background makes it readable
            // instead of painting it over the plugin logo.
            if (target.isKey())
                void target.setImage("imgs/blank");
            const unsubs = [gm.subscribe(address, render), gm.onConnectionChange(render)];
            if (mode === "level") {
                // The channel's name makes the meter identifiable on a dial.
                unsubs.push(gm.subscribe(channelName(this.busOf(settings), num(settings.channel, 0)), render));
            }
            this.releaseFor(target.id);
            this.cleanup.set(target.id, unsubs);
            render();
        }
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
        }
        async onSendToPlugin(ev) {
            streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
            if (datasourceEvent(ev.payload) !== "getGlobalChannels")
                return;
            const settings = await ev.action.getSettings();
            const gm = globalMixFor(globalConnectionOptions(settings));
            await replyGlobalChannelDatasource(gm, "getGlobalChannels", this.busOf(settings), false);
        }
        onKeyDown(ev) {
            this.refresh(ev.payload.settings);
        }
        onDialDown(ev) {
            this.refresh(ev.payload.settings);
        }
        refresh(settings) {
            const gm = globalMixFor(globalConnectionOptions(settings));
            gm.trigger(SEND_STATE, 1.0);
            gm.requestFullRefresh();
        }
        busOf(settings) {
            return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
                ? settings.bus
                : "input";
        }
        addressFor(settings) {
            switch (settings.mode ?? "level") {
                case "level":
                    return level(levelBusOf(this.busOf(settings)), num(settings.channel, 0));
                case "statusDevice":
                    return STATUS_DEVICE;
                case "statusConnection":
                    return STATUS_CONNECTION;
                case "statusDsp":
                    return STATUS_DSP;
                case "durecTime":
                    return DUREC_TIME;
                case "durecState":
                    return DUREC_STATE;
            }
        }
        labelFor(gm, settings) {
            switch (settings.mode ?? "level") {
                case "level": {
                    const ch = num(settings.channel, 0);
                    return gm.getString(channelName(this.busOf(settings), ch)) ?? `Level ${ch + 1}`;
                }
                case "statusDevice":
                    return "Device";
                case "statusConnection":
                    return "Connection";
                case "statusDsp":
                    return "DSP";
                case "durecTime":
                    return "DURec";
                case "durecState":
                    return "DURec";
            }
        }
        /** Formats the cached value for this mode; undefined = nothing received. */
        format(gm, settings, address) {
            const mode = settings.mode ?? "level";
            const cached = gm.get(address);
            if (cached === undefined)
                return undefined;
            switch (mode) {
                case "level": {
                    const dB = gm.getNumber(address, METER_FLOOR_DB);
                    // Deep under-range represents silence; rendered as the meter's empty
                    // state.
                    const text = dB <= METER_FLOOR_DB ? "-oo" : `${dB.toFixed(1)} dB`;
                    const bar = Math.round(Math.min(1, Math.max(0, (dB - METER_FLOOR_DB) / -METER_FLOOR_DB)) * 100);
                    return { text, bar };
                }
                case "statusConnection":
                    return { text: gm.getNumber(address, 0) >= 0.5 ? "Connected" : "No device" };
                case "statusDsp": {
                    // Unit is not documented; show the number exactly as sent.
                    const v = gm.get(address);
                    return { text: typeof v === "number" ? `${v}` : String(v) };
                }
                case "statusDevice":
                case "durecTime":
                case "durecState": {
                    const s = gm.getString(address);
                    return s === undefined ? undefined : { text: s };
                }
            }
        }
        async render(gm, target, settings) {
            const address = this.addressFor(settings);
            const formatted = this.format(gm, settings, address);
            // TotalMix transmits only changes, so silence is normal and the last known
            // value remains current. Only an empty cache shows the dash.
            const text = formatted?.text ?? "—";
            if (target.isDial()) {
                await target.setFeedback({
                    title: this.labelFor(gm, settings),
                    value: text,
                    indicator: { value: formatted?.bar ?? 0 },
                });
                return;
            }
            // Keys clip long text such as device names at the edge, so it is wrapped.
            await target.setTitle(wrapTitle(text));
        }
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
            const timer = this.renderTimers.get(id);
            if (timer !== undefined)
                clearTimeout(timer);
            this.renderTimers.delete(id);
            this.lastRender.delete(id);
        }
    });
    return _classThis;
})();

const img = (name) => `imgs/${name}`;
const pair = (base) => ({
    on: img(`${base}On`),
    off: img(`${base}Off`),
});
/** Fallback for parameters with no dedicated artwork. */
const GENERIC = pair("mute");
const ICONS = {
    // Main / Control Room
    mainDim: pair("dim"),
    mainMono: pair("mono"),
    mainMuteFx: pair("muteFX"),
    mainSpeakerB: pair("speakerB"),
    mainTalkback: pair("talkback"),
    mainExtIn: pair("extIn"),
    mainRecall: { on: img("recall"), off: img("recall") },
    // Global
    globalMute: pair("mute"),
    globalSolo: pair("solo"),
    trim: pair("trim"),
    // Strip in the current bank
    stripMute: pair("mute"),
    stripSolo: pair("solo"),
    stripPhantom: pair("phantom"),
    stripCue: pair("cue"),
    // Selected channel
    channelMute: pair("mute"),
    channelSolo: pair("solo"),
    channelPhantom: pair("phantom"),
    channelEq: pair("Eq"),
    channelLowcut: pair("Eq"),
    channelComp: pair("Comp"),
    // Groups and snapshots have no dedicated artwork in the v3 set; the mixer
    // glyph reads better than a mute symbol for these.
    muteGroup: pair("mute"),
    soloGroup: pair("solo"),
    faderGroup: pair("mixer"),
    snapshot: pair("mixer"),
    // Effects
    reverb: pair("mixer"),
    echo: pair("mixer"),
    roomEq: pair("Eq"),
};
const iconFor = (parameter) => ICONS[parameter] ?? GENERIC;

/** Parameters that live on a fixed bus regardless of the settings dropdown. */
const FORCED_BUS = {
    // Preamp hardware exists on inputs only.
    chPhantom: "input",
    chInstrument: "input",
    chPad: "input",
    chAutoset: "input",
    // Room EQ exists on outputs only.
    chRoomEq: "output",
};
/** L/R-split per the table: on stereo pairs, right = channel + 1. */
const LR_PARAMETERS = new Set(["chPhase"]);
const GROUP_PARAMETERS = new Set([
    "muteGroup",
    "soloGroup",
    "faderGroup",
]);
/** Reuse the classic action's artwork; parameters map onto the same glyphs. */
const ICON_ALIAS = {
    chMute: "stripMute",
    chPhase: "trim",
    chPhantom: "stripPhantom",
    chInstrument: "trim",
    chPad: "trim",
    chAutoset: "trim",
    chMsProc: "trim",
    chLoopback: "trim",
    chPfl: "stripSolo",
    chStereo: "trim",
    chRecord: "trim",
    chLowcut: "channelLowcut",
    chEq: "channelEq",
    chDynamics: "channelComp",
    chAutolevel: "channelComp",
    chRoomEq: "roomEq",
    dim: "mainDim",
    mono: "mainMono",
    talkback: "mainTalkback",
    externalIn: "mainExtIn",
    speakerB: "mainSpeakerB",
    muteFx: "mainMuteFx",
    linkAb: "mainSpeakerB",
    globalMute: "globalMute",
    globalSolo: "globalSolo",
    reverb: "reverb",
    echo: "echo",
    muteGroup: "muteGroup",
    soloGroup: "soloGroup",
    faderGroup: "faderGroup",
};
/**
 * On/off control over the Global OSC protocol.
 *
 * Every parameter here is stateful-set (the value IS the state; there is no
 * kOSCScaleToggle "send 1 to flip" in this protocol), so a press reads the
 * cached state and sends the inverse. The connection caches its own writes
 * optimistically, which also covers the group addresses TotalMix never reports:
 * for those the button's own presses ARE the state, noted in the PI.
 */
let GlobalToggle = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.globaltoggle" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        cleanup = new Map();
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "global");
            await this.setup(ev.action, ev.payload.settings);
        }
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        async setup(target, settings) {
            const gm = globalMixFor(globalConnectionOptions(settings));
            const address = this.addressFor(settings);
            const icons = iconFor(ICON_ALIAS[settings.parameter ?? "dim"]);
            const render = () => {
                const on = asBool(gm.get(address) ?? 0);
                if (target.isKey()) {
                    void target.setImage(on ? icons.on : icons.off);
                    void target.setState(on ? 1 : 0);
                }
                else {
                    void target.setFeedback({ value: on ? "On" : "Off" });
                }
            };
            this.releaseFor(target.id);
            this.cleanup.set(target.id, [gm.subscribe(address, render), gm.onConnectionChange(render)]);
            render();
        }
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
        }
        async onSendToPlugin(ev) {
            streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
            if (datasourceEvent(ev.payload) !== "getGlobalChannels")
                return;
            const settings = await ev.action.getSettings();
            const gm = globalMixFor(globalConnectionOptions(settings));
            const parameter = settings.parameter ?? "dim";
            await replyGlobalChannelDatasource(gm, "getGlobalChannels", this.busOf(settings), LR_PARAMETERS.has(parameter));
        }
        onKeyDown(ev) {
            const gm = globalMixFor(globalConnectionOptions(ev.payload.settings));
            const address = this.addressFor(ev.payload.settings);
            streamDeck.logger.info(`Key press: set-toggle ${address}`);
            gm.toggleSet(address);
        }
        busOf(settings) {
            const forced = FORCED_BUS[settings.parameter ?? "dim"];
            if (forced !== undefined)
                return forced;
            return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
                ? settings.bus
                : "input";
        }
        addressFor(settings) {
            const parameter = settings.parameter ?? "dim";
            const ch = num(settings.channel, 0);
            const index = num(settings.index, 1);
            const bus = this.busOf(settings);
            switch (parameter) {
                case "chMute":
                    return channel(bus, ch, "mute");
                case "chPhase":
                    return channel(bus, ch, "phase");
                case "chPhantom":
                    return channel(bus, ch, "48v");
                case "chInstrument":
                    return channel(bus, ch, "instrument");
                case "chPad":
                    return channel(bus, ch, "pad");
                case "chAutoset":
                    return channel(bus, ch, "autoset");
                case "chMsProc":
                    return channel(bus, ch, "msproc");
                case "chLoopback":
                    return channel(bus, ch, "loopback");
                case "chPfl":
                    return channel(bus, ch, "pfl");
                case "chStereo":
                    return channel(bus, ch, "stereo");
                case "chRecord":
                    return channel(bus, ch, "record");
                case "chLowcut":
                    return channel(bus, ch, "lowcut/enable");
                case "chEq":
                    return channel(bus, ch, "eq/enable");
                case "chDynamics":
                    return channel(bus, ch, "dynamics/enable");
                case "chAutolevel":
                    return channel(bus, ch, "autolevel/enable");
                case "chRoomEq":
                    return channel(bus, ch, "roomeq/enable");
                case "dim":
                    return CR_DIM;
                case "mono":
                    return CR_MAIN_MONO;
                case "talkback":
                    return CR_TALKBACK;
                case "externalIn":
                    return CR_EXTERNAL_IN;
                case "speakerB":
                    return CR_SPEAKER_B;
                case "muteFx":
                    return CR_MUTE_FX;
                case "linkAb":
                    return CR_LINK_AB;
                case "globalMute":
                    return GLOBAL_MUTE$1;
                case "globalSolo":
                    return GLOBAL_SOLO$1;
                case "reverb":
                    return REVERB_ENABLE$1;
                case "echo":
                    return ECHO_ENABLE$1;
                case "muteGroup":
                    return muteGroup$1(index);
                case "soloGroup":
                    return soloGroup$1(index);
                case "faderGroup":
                    return faderGroup$1(index);
            }
        }
        /** Exposed for tests. */
        static isGroupParameter(p) {
            return GROUP_PARAMETERS.has(p);
        }
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
        }
    });
    return _classThis;
})();

/** DURec keys light up when /durec/state carries their matching string. */
const DUREC_STATE_MATCH = {
    durecPlay: "Play",
    durecPause: "Pause",
    durecStop: "Stop",
    durecRecord: "Record",
};
/**
 * State artwork. mixerOff is the red glyph, mixerOn the green one: red while a
 * snapshot is not loaded or a transport state is not current, green while it is.
 * Applied with setImage because the manifest declares one pair for the whole
 * action. DisableAutomaticStates is set, so state follows TotalMix's reports
 * rather than key presses.
 */
const STATE_IMG = { on: "imgs/mixerOn", off: "imgs/mixerOff" };
/**
 * One-shot commands over the Global OSC protocol: everything typed (f) in the
 * table (value below 0.5 ignored, no state carried by the outgoing value), plus
 * the show/hide window pair, which is a plain f.
 *
 * Feedback where the protocol offers it:
 * - Snapshots: TotalMix signals 0 (off), 2 (active) or 3 (changed) on the same
 *   /snapshot/load/N address, so a snapshot key lights when its snapshot is
 *   active — including after loads from the GUI or a /snapshot/save.
 * - DURec transport: /durec/state carries "Not ready"/"Stop"/"Record"/"Play"/
 *   "Pause"; each transport key lights while its state is current.
 */
let GlobalTrigger = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.globaltrigger" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        cleanup = new Map();
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "global");
            await this.setup(ev.action, ev.payload.settings);
        }
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        async setup(target, settings) {
            const gm = globalMixFor(globalConnectionOptions(settings));
            const mode = settings.mode ?? "snapshot";
            const unsubs = [];
            if (mode === "snapshot") {
                const address = snapshotLoad(this.snapshotNumber(settings));
                const render = () => {
                    // 0 = off, 2 = active, 3 = changed; active and changed both mean
                    // this is the loaded snapshot.
                    const on = gm.getNumber(address, 0) >= 2;
                    if (target.isKey()) {
                        void target.setImage(on ? STATE_IMG.on : STATE_IMG.off);
                        void target.setState(on ? 1 : 0);
                    }
                };
                unsubs.push(gm.subscribe(address, render), gm.onConnectionChange(render));
                render();
            }
            else if (DUREC_STATE_MATCH[mode] !== undefined) {
                const render = () => {
                    const on = gm.getString(DUREC_STATE) === DUREC_STATE_MATCH[mode];
                    if (target.isKey()) {
                        void target.setImage(on ? STATE_IMG.on : STATE_IMG.off);
                        void target.setState(on ? 1 : 0);
                    }
                };
                unsubs.push(gm.subscribe(DUREC_STATE, render), gm.onConnectionChange(render));
                render();
            }
            else if (target.isKey()) {
                // One-shot modes (undo, layouts, show/hide window) carry no state, so
                // the icon must not move: the manifest or user artwork is restored and
                // the action parked on its neutral state.
                void target.setImage();
                void target.setState(0);
            }
            this.releaseFor(target.id);
            this.cleanup.set(target.id, unsubs);
        }
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
        }
        onKeyDown(ev) {
            const settings = ev.payload.settings;
            const gm = globalMixFor(globalConnectionOptions(settings));
            const mode = settings.mode ?? "snapshot";
            streamDeck.logger.info(`Key press: global trigger ${mode}`);
            switch (mode) {
                case "snapshot":
                    // The table: "only receive-value accepted: 1".
                    gm.trigger(snapshotLoad(this.snapshotNumber(settings)), 1.0);
                    return;
                case "layout":
                    gm.trigger(layoutLoad(Math.max(1, num(settings.index, 1))), 1.0);
                    return;
                case "undo":
                    gm.trigger(UNDO, 1.0);
                    return;
                case "redo":
                    gm.trigger(REDO, 1.0);
                    return;
                case "recall":
                    gm.trigger(CR_RECALL, 1.0);
                    return;
                case "durecPlay":
                    gm.trigger(DUREC_PLAY, 1.0);
                    return;
                case "durecPause":
                    gm.trigger(DUREC_PAUSE, 1.0);
                    return;
                case "durecStop":
                    // 1.0, never above 10: per the table, stopping a running recording
                    // takes two presses, and a value above 10 bypasses that
                    // confirmation.
                    gm.trigger(DUREC_STOP, 1.0);
                    return;
                case "durecRecord":
                    gm.trigger(DUREC_RECORD, 1.0);
                    return;
                case "durecNext":
                    gm.trigger(DUREC_NEXT, 1.0);
                    return;
                case "durecPrevious":
                    gm.trigger(DUREC_PREVIOUS, 1.0);
                    return;
                case "showWindow":
                    // Plain f, not (f): 1 shows, 0 hides.
                    gm.trigger(SHOW_WINDOW, 1.0);
                    return;
                case "hideWindow":
                    gm.trigger(SHOW_WINDOW, 0.0);
                    return;
            }
        }
        snapshotNumber(settings) {
            // TotalMix offers 8 snapshots, numbered from 1.
            return Math.min(Math.max(num(settings.index, 1), 1), 8);
        }
        /** Exposed for tests. */
        static durecMatch(mode) {
            return DUREC_STATE_MATCH[mode];
        }
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
        }
        /** Exposed for render-in-isolation tests. */
        connectionFor(settings) {
            return globalMixFor(globalConnectionOptions(settings));
        }
    });
    return _classThis;
})();

/**
 * Value scaling from RME's official OSC implementation table (TotalMix FX 1.96,
 * 22.07.2024). Formulas are transcribed verbatim and must not be simplified.
 *
 * The fader curve is non-linear in dB: a fixed step in the 0..1 wire domain
 * moves about 0.144 dB near the bottom of the throw and 0.033 dB near the top.
 * Dial stepping therefore converts to dB, steps a fixed dB, and converts back.
 */
/** Wire value 0.0 is this dB floor, displayed by TotalMix as -oo. */
const MIN_DB = -65;
/**
 * Wire value 1.0 is this dB ceiling.
 *
 * The published constants yield 6.0000000027 dB at fader position 1023 rather
 * than exactly 6.0, from rounding in the coefficients. Tests comparing against
 * the curve should allow a tolerance of ~1e-8.
 */
const MAX_DB = 6.0;
// The curve is piecewise, splitting at fader position 649/1023, which is exactly
// -6.0 dB. Both branches meet there, so the function is continuous and the
// inverse uses the matching -6.0 dB pivot.
const SPLIT_FADER_POS = 649.0;
const SPLIT_DB = -6;
const clamp01$1 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Converts a received fader value (0..1) to dB. */
function faderToDb(value) {
    const faderPos = clamp01$1(value) * 1023.0;
    if (faderPos >= SPLIT_FADER_POS) {
        return faderPos * 0.0320855615 - 26.8235294118;
    }
    return faderPos * faderPos * (-1 / 11033.0) + faderPos * 0.1497326203 - 65.0;
}
/** Converts dB to a fader value (0..1) suitable for sending. */
function dbToFader(dB) {
    if (Number.isNaN(dB))
        return 0;
    if (dB >= SPLIT_DB) {
        return clamp01$1(((dB + 26.8235294118) * (1.0 / 0.0320855615)) / 1023.0);
    }
    // Clamp first so -Infinity cannot produce NaN under the square root.
    const d = -34869 - 11033.0 * Math.max(dB, MIN_DB);
    return clamp01$1((826.0 - Math.sqrt(d)) / 1023.0);
}
/**
 * Steps a fader value by a fixed number of dB, the primitive used for a dial
 * detent or a volume up/down key.
 */
function stepDb(currentValue, deltaDb) {
    const dB = faderToDb(currentValue);
    return dbToFader(Math.min(Math.max(dB + deltaDb, MIN_DB), MAX_DB));
}
/** True when the fader sits at the bottom, which TotalMix shows as -oo. */
const isMinusInfinity = (value) => clamp01$1(value) <= 0;
/**
 * Formats a fader value for display. Used only when TotalMix's own "...Val"
 * string is unavailable.
 */
function formatDb(value) {
    // TotalMix renders minus infinity as the ASCII string "-oo". Matching it keeps
    // this fallback and TotalMix's own Val string consistent.
    if (isMinusInfinity(value))
        return "-oo";
    const dB = faderToDb(value);
    return `${dB >= 0 ? "+" : ""}${dB.toFixed(1)} dB`;
}
/** Maps a fader value to 0..100 for a Stream Deck+ touchscreen bar indicator. */
const faderToBar = (value) => Math.round(clamp01$1(value) * 100);

/**
 * Gain stepping for the Global Volume action: 1 dB per step, floor 0 dB, ceiling
 * per device. Kept decorator-free so tests can import it without dragging the
 * Stream Deck SDK in.
 */
const GAIN_MIN_DB = 0;
/** Ceiling used when the device is unknown, set to the highest known preamp span. */
const GAIN_MAX_DB = 75;
/**
 * Steps 1 dB per detent, rounding the current value to an integer first so an
 * off-grid cached value cannot produce an off-grid ladder.
 *
 * `maxDb` is the device ceiling from /status/device. Values above a device's
 * range are ignored by TotalMix, leaving the dial and the reading out of step.
 */
function stepGainDb(current, ticks, maxDb = GAIN_MAX_DB) {
    const ceiling = maxDb > GAIN_MIN_DB ? maxDb : GAIN_MAX_DB;
    return Math.min(ceiling, Math.max(GAIN_MIN_DB, Math.round(current) + ticks));
}

const DEFAULT_STEP_DB$1 = 1.5;
/**
 * Volume control over the Global OSC protocol.
 *
 * Addressing is absolute except for the "main" target: Global OSC has no
 * mastervolume address because the Main Out is an output channel, identified by
 * /controlroom/mainout as a 0-based output channel number. The action re-targets
 * when that assignment changes.
 *
 * Channel faders address /{input|playback|output}/{ch}/faderlin for all three
 * buses. State prefers faderlin; where only the dB sibling has arrived (mix
 * "fader", channel "volume") it is converted through the published curve. Writes
 * are always faderlin.
 */
let GlobalVolume = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.globalvolume" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        cleanup = new Map();
        /**
         * Last Main Out assignment seen per "main"-target action. Re-setup runs only
         * on an actual change; the cached-value delivery of a fresh subscription
         * would otherwise re-trigger setup indefinitely.
         */
        lastMainOut = new Map();
        /** Channels already primed with /sendchan this session, per connection. */
        primedChannels = new Set();
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "global", { stepDb: true });
            await this.setup(ev.action, ev.payload.settings);
        }
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        async setup(target, settings) {
            const gm = globalMixFor(globalConnectionOptions(settings));
            const render = () => {
                void this.render(gm, target, settings);
            };
            const unsubs = [gm.onConnectionChange(render)];
            if ((settings.target ?? "channel") === "main") {
                // Track the Main Out assignment; when it moves, re-subscribe to the
                // new output channel's addresses.
                unsubs.push(gm.subscribe(CR_MAINOUT, (v) => {
                    const ch = typeof v === "number" ? Math.round(v) : undefined;
                    if (ch === undefined)
                        return;
                    if (this.lastMainOut.get(target.id) === ch) {
                        render();
                        return;
                    }
                    this.lastMainOut.set(target.id, ch);
                    void this.setup(target, settings);
                }));
            }
            const address = this.addressFor(settings, gm);
            if (address !== undefined) {
                for (const c of this.levelCandidates(settings, gm, address)) {
                    unsubs.push(gm.subscribe(c.address, render));
                }
                // The Main Out assignment shifts which mix node is a candidate.
                if ((settings.target ?? "channel") === "channel") {
                    unsubs.push(gm.subscribe(CR_MAINOUT, render));
                }
            }
            for (const nameAddress of this.nameAddresses(settings, gm)) {
                unsubs.push(gm.subscribe(nameAddress, render));
            }
            // Requests this channel's parameters once. The bulk /sendall at connect
            // can be lost if the plugin starts before TotalMix.
            this.primeChannel(gm, settings);
            this.releaseFor(target.id);
            this.cleanup.set(target.id, unsubs);
            render();
        }
        primeChannel(gm, settings) {
            const spec = this.channelSpec(settings, gm);
            if (spec !== undefined) {
                const key = `${gm.options_.host}:${gm.options_.sendPort}:${spec.bus}:${spec.ch}`;
                if (!this.primedChannels.has(key)) {
                    this.primedChannels.add(key);
                    gm.trigger(sendChan(spec.bus, spec.ch), 1.0);
                }
            }
            // Input/playback channel faders arrive as mix nodes; pull their Main
            // Out submix so the dial has a starting value.
            if ((settings.target ?? "channel") === "channel") {
                const bus = this.busOf(settings);
                if (bus === "input" || bus === "playback") {
                    const outCh = this.submixOutOf(settings, gm);
                    const key = `${gm.options_.host}:${gm.options_.sendPort}:submix:${outCh}`;
                    if (!this.primedChannels.has(key)) {
                        this.primedChannels.add(key);
                        gm.trigger(sendSubmix(outCh), 1.0);
                    }
                }
            }
            // Mix-node targets request the whole submix. Value 1 requests all nodes;
            // value 2 would omit nodes below -65 dB, which a dial still needs.
            const node = this.mixNodeSpec(settings);
            if (node !== undefined) {
                const key = `${gm.options_.host}:${gm.options_.sendPort}:submix:${node.out}`;
                if (!this.primedChannels.has(key)) {
                    this.primedChannels.add(key);
                    gm.trigger(sendSubmix(node.out), 1.0);
                }
            }
        }
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
            this.lastMainOut.delete(ev.action.id);
        }
        async onSendToPlugin(ev) {
            streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
            const event = datasourceEvent(ev.payload);
            if (event === undefined)
                return;
            const settings = await ev.action.getSettings();
            const gm = globalMixFor(globalConnectionOptions(settings));
            if (event === "getGlobalChannels") {
                await replyGlobalChannelDatasource(gm, event, this.busOf(settings), false);
            }
            else if (event === "getGlobalGainChannels") {
                await replyGlobalChannelDatasource(gm, event, "input", true);
            }
            else if (event === "getGlobalSrcChannels") {
                await replyGlobalChannelDatasource(gm, event, (settings.mixSrcBus ?? "in") === "pb" ? "playback" : "input", false);
            }
            else if (event === "getGlobalOutChannels") {
                await replyGlobalChannelDatasource(gm, event, "output", false);
            }
            else if (event === "getGlobalSubmixChoices") {
                // Output list with "follow Main Out" prepended, for the submix picker.
                await new Promise((r) => setTimeout(r, 250));
                const items = [
                    { value: "auto", label: "Main Out (auto)" },
                    ...buildChannelItems(gm, "output", false),
                ];
                await streamDeck.ui.sendToPropertyInspector({ event, items });
            }
        }
        onDialRotate(ev) {
            this.step(ev, ev.payload.ticks);
        }
        onKeyDown(ev) {
            const ticks = (ev.payload.settings.nudge ?? "up") === "down" ? -1 : 1;
            this.step(ev, ticks);
        }
        step(ev, ticks) {
            const settings = ev.payload.settings;
            const gm = globalMixFor(globalConnectionOptions(settings));
            const address = this.addressFor(settings, gm);
            const isGain = (settings.target ?? "channel") === "gain";
            if (address === undefined) {
                // Before /controlroom/mainout arrives the target fader is unknown.
                streamDeck.logger.warn("Ignoring move: Main Out assignment not received yet");
                gm.requestFullRefresh();
                return;
            }
            let level = this.resolveLevel(gm, settings, address);
            if (level === undefined && (settings.target ?? "channel") === "channel") {
                // TotalMix 2.1 beta 2 does not transmit fader state for these channels
                // on any request. Seeds at -oo, the only value that cannot be louder
                // than intended, and steps from subsequent writes.
                streamDeck.logger.info(`No fader state from TotalMix for ${address}; starting from -oo and stepping locally.`);
                // Seeds on the last candidate: for input/playback that is the Main Out
                // mix node, the only fader form transmitted.
                const candidates = this.levelCandidates(settings, gm, address);
                const seedOn = candidates[candidates.length - 1] ?? { kind: "faderlin", address };
                level = { kind: "faderlin", address: seedOn.kind === "faderlin" ? seedOn.address : address, value: 0 };
            }
            if (level === undefined) {
                streamDeck.logger.warn(`Ignoring move on ${address}: no data received for it yet`);
                const spec = this.channelSpec(settings, gm);
                if (spec !== undefined)
                    gm.trigger(sendChan(spec.bus, spec.ch), 1.0);
                gm.requestFullRefresh();
                return;
            }
            const perTick = num(settings.stepDb, DEFAULT_STEP_DB$1);
            if (isGain) {
                const next = stepGainDb(level.value, ticks, detectedMaxGainDb(GAIN_MAX_DB));
                gm.setCoalesced(address, next);
                void this.render(gm, ev.action, settings, next);
                return;
            }
            // Step in the representation TotalMix reported (or the seed).
            let next01;
            if (level.kind === "faderlin") {
                next01 = stepDb(level.value, ticks * perTick);
                gm.setCoalesced(level.address, next01);
            }
            else {
                const nextDb = Math.min(MAX_DB, Math.max(MIN_DB, level.value + ticks * perTick));
                gm.setCoalesced(level.address, nextDb);
                next01 = dbToFader(nextDb);
            }
            // Wire capture confirmed the device's dialect: output levels live on
            // /output/N/faderlin, input/playback levels ONLY on the /mix tree —
            // the channel-tree fader forms for in/pb are never transmitted. The
            // resolved candidate above already IS the confirmed form, so the single
            // write to level.address is the whole job.
            void this.render(gm, ev.action, settings, next01);
        }
        /**
         * The level parameter to step, in the representation TotalMix actually used
         * for this channel: faderlin (0..1 curve) where reported, otherwise the dB
         * sibling (mix "fader", channel "volume"). Gain reports itself.
         */
        resolveLevel(gm, settings, address) {
            // Try every address TotalMix might have used for this level, and answer
            // on the one it actually spoke. Which one that is depends on the Global
            // OSC Detailed Settings ("Send faders in linear scale") and on the bus:
            // output faders arrive as channel faderlin/volume, while input/playback
            // levels are observed to arrive as mix-tree messages.
            for (const c of this.levelCandidates(settings, gm, address)) {
                const v = gm.get(c.address);
                if (typeof v === "number")
                    return { kind: c.kind, address: c.address, value: v };
            }
            return undefined;
        }
        /** All addresses this target's level may arrive on, most specific first. */
        levelCandidates(settings, gm, address) {
            const out = [
                { kind: "faderlin", address },
            ];
            const dbSibling = this.volumeFallbackFor(settings, gm);
            if (dbSibling !== undefined)
                out.push({ kind: "db", address: dbSibling });
            // Input/playback channel faders: also accept the channel's node into the
            // Main Out submix — the form TotalMix transmits for these buses.
            if ((settings.target ?? "channel") === "channel") {
                const bus = this.busOf(settings);
                if (bus === "input" || bus === "playback") {
                    const src = bus === "input" ? "in" : "pb";
                    const ch = num(settings.channel, 0);
                    const outCh = this.submixOutOf(settings, gm);
                    out.push({ kind: "faderlin", address: mixFaderlin(src, ch, outCh) });
                    out.push({ kind: "db", address: mixNode(src, ch, outCh, "fader") });
                }
            }
            return out;
        }
        /** The current value as faderlin 0..1, for display, whatever the source. */
        currentValue(gm, settings, address) {
            const level = this.resolveLevel(gm, settings, address);
            if (level === undefined)
                return undefined;
            if (level.kind === "faderlin")
                return level.value;
            return dbToFader(Math.min(Math.max(level.value, MIN_DB), MAX_DB));
        }
        /**
         * The dB sibling of a faderlin address, where one exists: mix nodes carry
         * "fader" (documented [dB]); output channels carry "volume".
         */
        volumeFallbackFor(settings, gm) {
            const node = this.mixNodeSpec(settings);
            if (node !== undefined)
                return mixNode(node.src, node.in_, node.out, "fader");
            const spec = this.channelSpec(settings, gm);
            const target = settings.target ?? "channel";
            if (spec === undefined || target === "gain")
                return undefined;
            return channel(spec.bus, spec.ch, "volume");
        }
        /** The mix node the explicit mixNode target resolves to. */
        mixNodeSpec(settings) {
            if ((settings.target ?? "channel") !== "mixNode")
                return undefined;
            return {
                src: settings.mixSrcBus ?? "in",
                in_: num(settings.mixSrc, 0),
                out: num(settings.mixOut, 0),
            };
        }
        /** Resolves the bus + channel a channel-scoped target points at. */
        channelSpec(settings, gm) {
            switch (settings.target ?? "channel") {
                case "channel":
                    return { bus: this.busOf(settings), ch: num(settings.channel, 0) };
                case "gain":
                    // Legacy fallback: pre-4.1.1 configs stored the gain channel in
                    // "channel" before the setting was split.
                    return { bus: "input", ch: num(settings.gainChannel ?? settings.channel, 0) };
                case "main": {
                    const assigned = gm.get(CR_MAINOUT);
                    if (typeof assigned !== "number")
                        return undefined;
                    return { bus: "output", ch: Math.round(assigned) };
                }
                case "mixNode":
                    return undefined;
            }
        }
        /** The output channel whose submix an in/pb fader targets. */
        submixOutOf(settings, gm) {
            const raw = settings.submixOut;
            if (raw !== undefined && String(raw).trim() !== "" && String(raw) !== "auto") {
                return num(raw, 0);
            }
            const mainOut = gm.get(CR_MAINOUT);
            return typeof mainOut === "number" ? Math.round(mainOut) : 0;
        }
        busOf(settings) {
            return settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
                ? settings.bus
                : "output";
        }
        addressFor(settings, gm) {
            const node = this.mixNodeSpec(settings);
            if (node !== undefined)
                return mixFaderlin(node.src, node.in_, node.out);
            const target = settings.target ?? "channel";
            const spec = this.channelSpec(settings, gm);
            if (spec === undefined)
                return undefined;
            return target === "gain" ? channelGain(spec.ch) : channelFaderlin(spec.bus, spec.ch);
        }
        /**
         * Dial press: dim for the Main target (the monitoring gesture the classic
         * action uses), mute for channel/gain, solo for a mix node.
         */
        onDialDown(ev) {
            const settings = ev.payload.settings;
            const gm = globalMixFor(globalConnectionOptions(settings));
            const target = settings.target ?? "channel";
            if (target === "main") {
                gm.toggleSet(CR_DIM);
                return;
            }
            if (target === "mixNode") {
                gm.toggleSet(mixSolo(settings.mixSrcBus ?? "in", num(settings.mixSrc, 0), num(settings.mixOut, 0)));
                return;
            }
            const spec = this.channelSpec(settings, gm);
            if (spec !== undefined)
                gm.toggleSet(channelMute(spec.bus, spec.ch));
        }
        /** Name addresses whose arrival should refresh this action's title. */
        nameAddresses(settings, gm) {
            const target = settings.target ?? "channel";
            if (target === "mixNode") {
                return [
                    channelName((settings.mixSrcBus ?? "in") === "pb" ? "playback" : "input", num(settings.mixSrc, 0)),
                    channelName("output", num(settings.mixOut, 0)),
                ];
            }
            const spec = this.channelSpec(settings, gm);
            return spec === undefined ? [] : [channelName(spec.bus, spec.ch)];
        }
        labelFor(gm, settings) {
            const target = settings.target ?? "channel";
            if (target === "mixNode") {
                const srcBus = (settings.mixSrcBus ?? "in") === "pb" ? "playback" : "input";
                const src = gm.getString(channelName(srcBus, num(settings.mixSrc, 0))) ??
                    `${srcBus === "playback" ? "PB" : "In"} ${num(settings.mixSrc, 0) + 1}`;
                const out = gm.getString(channelName("output", num(settings.mixOut, 0))) ??
                    `Out ${num(settings.mixOut, 0) + 1}`;
                return `${src} → ${out}`;
            }
            if (target === "main") {
                const spec = this.channelSpec(settings, gm);
                return spec === undefined
                    ? "Main"
                    : (gm.getString(channelName("output", spec.ch)) ?? "Main");
            }
            const spec = this.channelSpec(settings, gm);
            if (spec === undefined)
                return "Ch";
            const fallback = target === "gain" ? `Gain ${spec.ch + 1}` : `Ch ${spec.ch + 1}`;
            return gm.getString(channelName(spec.bus, spec.ch)) ?? fallback;
        }
        async render(gm, target, settings, override) {
            const address = this.addressFor(settings, gm);
            const isGain = (settings.target ?? "channel") === "gain";
            const value = override ??
                (address !== undefined ? this.currentValue(gm, settings, address) : undefined);
            if (value === undefined) {
                if (target.isDial()) {
                    await target.setFeedback({
                        title: this.labelFor(gm, settings),
                        value: "—",
                        indicator: { value: 0 },
                    });
                }
                else {
                    await target.setTitle("—");
                }
                return;
            }
            // No Val strings in this protocol; both formats are exact from the table:
            // faderlin via the published curve, gain as the whole-dB value it is.
            const label = isGain ? `${Math.round(value)} dB` : formatDb(value);
            // The fill bar shares the stepping ceiling, so on a 65 dB device the dial
            // reads full at 65 rather than stopping at 87% of its travel.
            const bar = isGain
                ? Math.round(Math.min(1, Math.max(0, value / detectedMaxGainDb(GAIN_MAX_DB))) * 100)
                : faderToBar(value);
            if (target.isDial()) {
                await target.setFeedback({
                    title: this.labelFor(gm, settings),
                    value: gm.connected ? label : "—",
                    indicator: { value: bar },
                });
                return;
            }
            await target.setTitle(gm.connected ? label : "—");
        }
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
        }
    });
    return _classThis;
})();

/** TotalMix's factory settings for Remote Controller slot 1. */
const DEFAULT_OPTIONS = {
    host: "127.0.0.1",
    sendPort: 7001,
    receivePort: 9001,
};
const DEFAULT_TIMING = { staleMs: 5000, refreshMs: 2000 };
/** Outbound flush interval: one send per address per tick. */
const SEND_COALESCE_MS = 25;
class TotalMixConnection {
    socket = null;
    options = DEFAULT_OPTIONS;
    /**
     * Non-positional state (mastervolume, mainDim, groups…): one value globally,
     * because these mean the same thing in every view.
     */
    globals = new Map();
    /**
     * Positional state, retained per view. /1/volume3 under (playback, bank 0,
     * submix Main) and under (input, bank 0, submix Main) are different faders;
     * both values are kept, each under its own key. A view change adds a slice
     * rather than replacing one, so a read for a non-current view still
     * resolves.
     */
    viewState = new Map();
    /**
     * The view (bus + bank start) the positional page-1 addresses currently refer
     * to. Page-1 keys like /1/volume3 mean "the third fader of the current view" —
     * they are positions, not channels — so a cached value is only meaningful for
     * the view it was captured under. undefined = unknown.
     */
    view = {};
    /** Address -> subscribers. Actions are woken only for what they asked for. */
    listeners = new Map();
    /** Pending outbound values, flushed on a timer so dials cannot flood the wire. */
    pending = new Map();
    flushTimer = null;
    /** Pending return to the slot's own page after an off-page command. */
    restoreTimer = null;
    refreshTimer = null;
    lastInbound = 0;
    connectedFlag = false;
    /**
     * True once at least one non-heartbeat message has arrived. TotalMix sends
     * heartbeats regardless of whether a refresh request was received, so
     * inbound traffic alone does not imply a populated cache. While false, the
     * refresh timer re-requests the page dump.
     */
    primed = false;
    /** Views actions have declared they need, each primed once at startup. */
    primeQueue = [];
    primedViews = new Set();
    /**
     * Every view an action has required, kept for the connection's lifetime.
     *
     * Page-1 addressing is control-element oriented with dynamic mapping to
     * channels depending on bank assignment, not fixed per channel: /1/mute/1/1
     * means strip 1 of the currently selected bus and bank. A slot selects one
     * view at a time, so a refresh carries values for that view only.
     */
    knownViews = [];
    primeTimer = null;
    timing;
    constructor(timing = {}) {
        this.timing = { ...DEFAULT_TIMING, ...timing };
    }
    /**
     * The page this slot mirrors. Page 1 (the mixer) is what nearly everything
     * needs; off-page commands hop away and come back rather than changing this.
     */
    page = 1;
    /** Guards the one-shot "first inbound" diagnostic in handlePacket. */
    loggedFirstInbound = false;
    /** Connection up/down subscribers, separate from per-address listeners. */
    connectionListeners = new Set();
    /** True while inbound OSC is arriving; see setConnected for the transitions. */
    get connected() {
        return this.connectedFlag;
    }
    /**
     * The resolved host and ports, after the string coercion connect() applies.
     * Trailing underscore avoids colliding with the private `options` field.
     */
    get options_() {
        return this.options;
    }
    /**
     * Opens the socket, or reopens it if the receive port changed. Idempotent;
     * called by every action on appear.
     */
    async connect(options = {}) {
        // Property inspector settings arrive as strings; coerced here so a
        // string port does not register as a port change.
        const next = {
            host: options.host !== undefined ? String(options.host) : this.options.host,
            sendPort: options.sendPort !== undefined ? Number(options.sendPort) : this.options.sendPort,
            receivePort: options.receivePort !== undefined ? Number(options.receivePort) : this.options.receivePort,
        };
        if (!Number.isFinite(next.sendPort) || !Number.isFinite(next.receivePort)) {
            streamDeck.logger.error(`Ignoring invalid ports (send=${String(options.sendPort)}, receive=${String(options.receivePort)})`);
            return;
        }
        const portChanged = this.socket !== null && next.receivePort !== this.options.receivePort;
        this.options = next;
        if (this.socket !== null && !portChanged) {
            return;
        }
        if (portChanged) {
            this.closeSocket();
        }
        await this.openSocket();
        this.startRefreshTimer();
        this.requestFullRefresh();
    }
    /**
     * Binds the receive port. Resolves on "listening", and also on a bind
     * failure, so connect() settles either way.
     */
    openSocket() {
        return new Promise((resolve) => {
            // No reuseAddr: on UDP it permits two sockets on one port, with only
            // one of them receiving traffic. Without it, a taken port raises
            // EADDRINUSE in the error handler below.
            const socket = dgram.createSocket({ type: "udp4" });
            socket.on("message", (buf) => this.handlePacket(buf));
            socket.on("error", (err) => {
                const inUse = err.code === "EADDRINUSE";
                streamDeck.logger.error(inUse
                    ? `OSC: udp/${this.options.receivePort} is already in use — ` +
                        `check that no other program (or the Global OSC slot) listens on this port.`
                    : `OSC socket error: ${err.message}`);
                // Do not rethrow: an unhandled error here would take the plugin down.
                this.setConnected(false);
                this.closeSocket();
                // Bind failures arrive on this event rather than as a synchronous
                // throw, so the promise is settled here as well.
                resolve();
            });
            socket.on("listening", () => {
                streamDeck.logger.info(`Listening for TotalMix on udp/${this.options.receivePort}, ` +
                    `sending to ${this.options.host}:${this.options.sendPort}`);
                resolve();
            });
            try {
                socket.bind(this.options.receivePort);
                this.socket = socket;
            }
            catch (err) {
                streamDeck.logger.error(`Could not bind udp/${this.options.receivePort}: ${err}`);
                resolve();
            }
        });
    }
    /**
     * Entry point for every inbound datagram: refreshes the liveness clock, then
     * applies each message. A malformed packet parses to no messages and is
     * dropped without altering the connection state.
     */
    handlePacket(buf) {
        const messages = parsePacket(buf);
        if (messages.length === 0)
            return;
        const now = Date.now();
        // Inbound resuming after a gap longer than staleMs indicates a TotalMix
        // restart: the slot's page and state are unknown, so the cache is
        // re-primed even though packets are arriving.
        const resumedAfterGap = this.lastInbound !== 0 && now - this.lastInbound > this.timing.staleMs;
        const hasData = messages.some((m) => !isHeartbeat(m));
        if (hasData) {
            this.primed = true;
        }
        else if (resumedAfterGap) {
            this.primed = false;
            this.requestFullRefresh();
        }
        // One-shot diagnostic: records that inbound OSC arrived and which page
        // TotalMix is mirroring.
        if (!this.loggedFirstInbound) {
            this.loggedFirstInbound = true;
            const sample = messages.slice(0, 8).map((m) => m.address).join(", ");
            streamDeck.logger.info(`First inbound OSC: ${messages.length} message(s). Sample: ${sample}`);
        }
        this.lastInbound = now;
        this.setConnected(true);
        for (const m of messages) {
            this.applyMessage(m);
        }
    }
    /**
     * Files one message into the right cache and wakes its subscribers.
     *
     * Order matters: the view-tracking addresses (labelSubmix, busX) are read
     * first, so a dump that begins by announcing its view has the rest of its
     * messages stored under that view rather than the previous one.
     */
    applyMessage(m) {
        if (isHeartbeat(m))
            return;
        // TotalMix reports the active bus as busX = 1.0, and the active submix as
        // /1/labelSubmix. Both are view dimensions: selecting another submix
        // re-sends every volumeN as that submix's send level, so the same
        // positional addresses carry different values per submix.
        if (m.address === "/1/labelSubmix" && typeof m.value === "string") {
            // Key component only: each submix retains its own slice.
            this.view.submix = m.value;
        }
        if (m.address === "/1/busInput" || m.address === "/1/busPlayback" || m.address === "/1/busOutput") {
            const bus = m.address === "/1/busInput" ? "input" : m.address === "/1/busPlayback" ? "playback" : "output";
            const active = typeof m.value === "number" ? m.value >= 0.5 : m.value === true;
            if (active)
                this.view.bus = bus;
        }
        const positional = TotalMixConnection.POSITIONAL.test(m.address);
        const store = positional ? this.viewMap(this.viewKey()) : this.globals;
        const previous = store.get(m.address);
        if (previous === m.value)
            return; // unchanged; do not wake subscribers
        store.set(m.address, m.value);
        const subs = this.listeners.get(m.address);
        if (subs === undefined)
            return;
        for (const fn of subs) {
            try {
                fn(m.value);
            }
            catch (err) {
                // One misbehaving action must not stop the others being updated.
                streamDeck.logger.error(`Listener for ${m.address} threw: ${err}`);
            }
        }
    }
    /**
     * Current cached value for an address, or undefined if never received.
     *
     * For positional addresses `req` picks which view's retained slice to read.
     * Passing it lets an action see its own bus's data while the slot is parked
     * elsewhere; omitting it reads whatever view is current, which is only
     * correct for addresses that mean the same thing everywhere.
     */
    get(address, req) {
        if (TotalMixConnection.POSITIONAL.test(address)) {
            return this.viewState.get(this.viewKey(req))?.get(address);
        }
        return this.globals.get(address);
    }
    /**
     * Numeric read. Booleans collapse to 1/0 because TotalMix sends some on/off
     * parameters as OSC booleans and others as floats for the same concept.
     */
    getNumber(address, fallback = 0, req) {
        const v = this.get(address, req);
        return typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : fallback;
    }
    /**
     * String read, for labels and the "...Val" display strings. Returns
     * undefined rather than coercing, so callers can fall back deliberately.
     */
    getString(address, req) {
        const v = this.get(address, req);
        return typeof v === "string" ? v : undefined;
    }
    /**
     * Subscribes to an address. Returns an unsubscribe function — call it from the
     * action's onWillDisappear, or listeners accumulate as profiles switch.
     */
    subscribe(address, listener) {
        let subs = this.listeners.get(address);
        if (subs === undefined) {
            subs = new Set();
            this.listeners.set(address, subs);
        }
        subs.add(listener);
        // Deliver the cached value immediately so a button that has just appeared
        // renders correctly instead of waiting for the next change.
        const cached = this.get(address);
        if (cached !== undefined) {
            queueMicrotask(() => listener(cached));
        }
        return () => {
            const set = this.listeners.get(address);
            if (set === undefined)
                return;
            set.delete(listener);
            if (set.size === 0)
                this.listeners.delete(address);
        };
    }
    /**
     * Subscribes to connection up/down. Fires immediately with the current state
     * so a button appearing on a dead connection renders its placeholder at once
     * instead of waiting for the next transition. Returns an unsubscribe.
     */
    onConnectionChange(listener) {
        this.connectionListeners.add(listener);
        listener(this.connectedFlag);
        return () => this.connectionListeners.delete(listener);
    }
    /** Notifies on transitions only, so idle traffic does not re-render every key. */
    setConnected(connected) {
        if (this.connectedFlag === connected)
            return;
        this.connectedFlag = connected;
        for (const fn of this.connectionListeners) {
            try {
                fn(connected);
            }
            catch {
                /* ignore */
            }
        }
    }
    /**
     * Sends immediately, bypassing coalescing. Use for discrete events — toggles,
     * navigation, snapshot recall — where every message is meaningful.
     */
    send(address, value) {
        // Every discrete command is logged, so a key press leaves a trace.
        streamDeck.logger.debug(`OSC out: ${address} = ${value}`);
        this.trackViewChange(address, value);
        this.sendBuffer(encodeFloat(address, Number(value)));
    }
    /**
     * Sends a command belonging to another page, then returns the slot to its own
     * page.
     *
     * Any parameter carrying a page number selects that page for the slot, so an
     * off-page command leaves the connection mirroring that page and stops
     * updates for every address on the slot's own page.
     *
     * The return is deferred so the command is processed before the page moves,
     * and so a burst of sends (a dial spun through an FX parameter) costs one
     * page dump rather than one per detent.
     */
    sendOffPage(address, value) {
        const page = pageOf(address);
        this.send(address, value);
        if (page === this.page)
            return;
        if (this.restoreTimer !== null)
            clearTimeout(this.restoreTimer);
        this.restoreTimer = setTimeout(() => {
            this.restoreTimer = null;
            streamDeck.logger.debug(`Returning slot to page ${this.page} after a page-${page} command.`);
            // A snapshot recall changes the mixer without emitting individual
            // parameter updates, so values are re-requested. A full refresh
            // forces the page transition that triggers the re-send.
            this.requestFullRefresh();
            // The refresh returns only the selected bus; a snapshot changes all.
            this.revisitViews();
        }, TotalMixConnection.PAGE_RESTORE_MS);
    }
    /**
     * Tracks outbound commands that move the shared view, so positional cache
     * entries are read back under the view they were captured in.
     */
    trackViewChange(address, value) {
        switch (address) {
            case "/1/busInput":
                this.view.bus = "input";
                return;
            case "/1/busPlayback":
                this.view.bus = "playback";
                return;
            case "/1/busOutput":
                this.view.bus = "output";
                return;
            case "/setBankStart":
                this.view.bank = value;
                return;
            case "/1/bank+":
            case "/1/bank-":
            case "/1/track+":
            case "/1/track-":
                // Relative moves by an unknown amount: the resulting "?"-bank
                // slice would merge two real banks, so it is dropped.
                this.view.bank = undefined;
                this.viewState.delete(this.viewKey());
                return;
            case "/setSubmix":
                // The resulting dump carries labelSubmix, which re-keys the slice.
                return;
        }
    }
    /**
     * Addresses whose meaning depends on the current view, and which therefore
     * belong in a per-view slice rather than the global map.
     *
     * These are the page-1 strip parameters: /1/volume3 is "the third fader of
     * whatever bus and bank the slot is showing", not a fixed channel. Two
     * families appear, matching RME's own two address shapes — indexed
     * (volume3, trackname3, and their "Val" display twins) and matrix-style
     * (mute/1/3, where the middle number is the row).
     *
     * Everything not matched here — mastervolume, mainDim, group states — means
     * the same thing in every view and is stored globally. The pattern is
     * anchored at both ends and matches whole addresses only.
     */
    static POSITIONAL = /^\/1\/(?:(?:volume|pan|micgain|trackname)\d+(?:Val)?|(?:mute|solo|phantom|cue|select)\/1\/\d+)$/;
    /** Drops all per-view state, for use after a TotalMix restart. */
    invalidateBankView() {
        this.viewState.clear();
    }
    /**
     * Cache key for a view: bus, bank and submix, the three dimensions that
     * change what a positional address refers to.
     *
     * Components of `req` override the current view, which is how a read reaches
     * another view's slice. Unknown components render as "?" and key their own
     * slice, keeping data captured before the view was known separate from a
     * real view's slice.
     */
    viewKey(req) {
        const bus = req?.bus ?? this.view.bus ?? "?";
        const bank = req?.bank ?? this.view.bank ?? "?";
        const submix = this.view.submix ?? "?";
        return `${bus}:${bank}:${submix}`;
    }
    /** The slice for a view key, created on first write. */
    viewMap(key) {
        let m = this.viewState.get(key);
        if (m === undefined) {
            m = new Map();
            this.viewState.set(key, m);
        }
        return m;
    }
    /**
     * Declares that an action needs data for this view. Each required view is
     * visited once after the connection comes up: bus and bank are asserted and
     * the resulting dump is collected into that view's slice, so an action holds
     * its own data before its first gesture. Visits run serially.
     */
    requireView(req) {
        if (req.bus === undefined && req.bank === undefined)
            return;
        const key = `${req.bus ?? "?"}:${req.bank ?? "?"}`;
        if (this.primedViews.has(key))
            return;
        this.primedViews.add(key);
        this.knownViews.push(req);
        this.primeQueue.push(req);
        this.schedulePrimeVisit();
    }
    /** Bus name to the page-1 address that selects it, for the prime walk. */
    static BUS_ADDRESS = {
        input: "/1/busInput",
        playback: "/1/busPlayback",
        output: "/1/busOutput",
    };
    /**
     * Queues every known view for a visit, refreshing each view's cached slice.
     * Visits are spaced by the prime interval, as at startup.
     */
    revisitViews() {
        if (this.knownViews.length === 0)
            return;
        for (const req of this.knownViews)
            this.primeQueue.push(req);
        this.schedulePrimeVisit();
    }
    /**
     * Runs the prime queue one view at a time, rescheduling itself until it
     * drains. Each visit moves the shared slot, so visits must not overlap: a
     * second select landing during the first visit's dump would file those
     * values under the wrong view.
     *
     * The single timer also serves as the "walk in progress" flag, so callers
     * can queue work and call this unconditionally.
     */
    schedulePrimeVisit() {
        if (this.primeTimer !== null || this.primeQueue.length === 0)
            return;
        // 400 ms per visit: a full page dump takes about 80 ms, so each dump
        // completes before the next select moves the slot.
        this.primeTimer = setTimeout(() => {
            this.primeTimer = null;
            if (!this.primed) {
                // No state has arrived yet; the startup refresh is still
                // outstanding, so the walk waits and reschedules.
                this.schedulePrimeVisit();
                return;
            }
            const req = this.primeQueue.shift();
            if (req !== undefined) {
                if (req.bus !== undefined)
                    this.send(TotalMixConnection.BUS_ADDRESS[req.bus], 1.0);
                if (req.bank !== undefined)
                    this.send("/setBankStart", req.bank);
            }
            this.schedulePrimeVisit();
        }, 400);
        this.primeTimer.unref?.();
    }
    /**
     * Whether the current view matches the given requirements. An unknown view
     * counts as a mismatch when a requirement is stated.
     *
     * Callers use this to decide whether a write needs the view pinned first;
     * reads should instead pass the requirement to get()/getNumber(), which
     * reach that view's retained slice without moving the slot.
     */
    viewMatches(req) {
        if (req.bus !== undefined && this.view.bus !== req.bus)
            return false;
        if (req.bank !== undefined && this.view.bank !== req.bank)
            return false;
        return true;
    }
    /**
     * Sends an integer-typed argument. Only the few parameters RME types as "i"
     * need this; everything else on the wire is a float, including values that
     * read as whole numbers.
     */
    sendInt(address, value) {
        this.sendBuffer(encodeInt(address, value));
    }
    /**
     * Queues a continuous value, coalescing repeats to the same address. Use for
     * dial rotation and fader drags, where only the latest value matters.
     */
    sendCoalesced(address, value) {
        this.pending.set(address, value);
        // Optimistically update the cache so a fast dial reads back its own latest
        // position rather than a stale one while TotalMix catches up.
        (TotalMixConnection.POSITIONAL.test(address) ? this.viewMap(this.viewKey()) : this.globals).set(address, value);
        if (this.flushTimer !== null)
            return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.restoreTimer = null;
            const batch = [...this.pending];
            this.pending.clear();
            for (const [addr, v] of batch) {
                this.sendBuffer(encodeFloat(addr, v));
            }
        }, SEND_COALESCE_MS);
    }
    /**
     * Flips a kOSCScaleToggle parameter. Sends 1.0 and lets TotalMix report the
     * resulting state — no read-modify-write, so no race with the GUI.
     */
    toggle(address) {
        // Snapshots, groups and FX enables reach TotalMix through here and are
        // page-2/3 addresses, so this must go through the page-restoring path.
        // For page-1 addresses sendOffPage adds one comparison.
        this.sendOffPage(address, 1.0);
    }
    sendBuffer(buf) {
        const socket = this.socket;
        if (socket === null) {
            streamDeck.logger.warn("OSC send skipped: socket not open");
            return;
        }
        // send() can throw synchronously, e.g. on a socket caught mid-close. The
        // throw is contained and logged here rather than propagating into the
        // key handler.
        try {
            socket.send(buf, this.options.sendPort, this.options.host, (err) => {
                if (err)
                    streamDeck.logger.error(`OSC send failed: ${err.message}`);
            });
        }
        catch (err) {
            streamDeck.logger.error(`OSC send threw: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    /** Delay before returning to the slot's own page, sized to absorb a dial burst. */
    static PAGE_RESTORE_MS = 250;
    /**
     * One kOSCScaleToggle address per page; 0.0 is inert on a toggle. globalMute
     * exists on pages 1 and 3 only, so pages 2 and 4 use their own addresses.
     * All four are present in osc-spec.json.
     */
    static PAGE_TOUCH = {
        1: "/1/globalMute",
        2: "/2/mute",
        3: "/3/globalMute",
        4: "/4/reqEnable",
    };
    /**
     * Asks TotalMix to re-send the parameters of one page.
     *
     * Per RME's spec, sending any parameter carrying a page number makes TotalMix
     * re-send every parameter of that page and selects that page for the slot. A
     * slot mirrors one page at a time, so the refresh must end on the slot's own
     * page.
     *
     * Value 0.0 is inert on a kOSCScaleToggle address — only 1.0 flips it — so
     * the refresh changes no state.
     */
    requestFullRefresh() {
        // The re-send fires only when a parameter carries a new page number, so
        // touching the current page is a no-op. Two sends force a transition:
        // one onto a neighbouring page, one back. Each triggers that page's
        // re-send, and the second leaves the slot on its own page.
        const away = this.page === 1 ? 2 : 1;
        this.send(TotalMixConnection.PAGE_TOUCH[away], 0.0);
        this.send(TotalMixConnection.PAGE_TOUCH[this.page], 0.0);
    }
    /**
     * Selects which page this connection mirrors. Page 1 is the mixer (faders,
     * mutes, main out) and is what most actions need.
     */
    setPage(page) {
        if (this.page === page)
            return;
        this.page = page;
        this.requestFullRefresh();
    }
    startRefreshTimer() {
        if (this.refreshTimer !== null)
            return;
        this.refreshTimer = setInterval(() => {
            const silent = Date.now() - this.lastInbound;
            if (silent > this.timing.staleMs) {
                if (this.connectedFlag) {
                    streamDeck.logger.warn(`No OSC from TotalMix for ${Math.round(silent / 1000)}s — re-requesting page ${this.page}.`);
                }
                this.setConnected(false);
                // Covers a TotalMix restart or OSC being re-enabled: re-asserting
                // the page re-establishes the stream.
                this.requestFullRefresh();
            }
            else if (!this.primed) {
                // Heartbeats are arriving but no state has, so the initial
                // refresh request was lost. The request repeats until state
                // arrives; once primed, this branch stops running.
                this.requestFullRefresh();
            }
        }, this.timing.refreshMs);
        // Do not hold the process open on this timer alone.
        this.refreshTimer.unref?.();
    }
    /**
     * Closes and forgets the socket. Tolerates an already-closed socket, which
     * happens when the error handler and an explicit close race.
     */
    closeSocket() {
        if (this.socket === null)
            return;
        try {
            this.socket.close();
        }
        catch {
            /* already closed */
        }
        this.socket = null;
    }
    /** Releases everything. Called on plugin shutdown. */
    dispose() {
        if (this.flushTimer !== null)
            clearTimeout(this.flushTimer);
        if (this.restoreTimer !== null)
            clearTimeout(this.restoreTimer);
        if (this.refreshTimer !== null)
            clearInterval(this.refreshTimer);
        if (this.primeTimer !== null)
            clearTimeout(this.primeTimer);
        this.primeTimer = null;
        this.flushTimer = null;
        this.refreshTimer = null;
        this.listeners.clear();
        this.connectionListeners.clear();
        this.globals.clear();
        this.viewState.clear();
        this.closeSocket();
    }
}
/**
 * Connection pool, one entry per TotalMix Remote Controller slot.
 *
 * TotalMix mirrors one view (bus + bank + page) per remote controller slot and
 * offers four slots. Connections are keyed on their port pair, so actions
 * configured for different slots hold independent views; actions sharing a port
 * pair share one connection.
 */
const pool = new Map();
/**
 * The connection for a host and port pair, created on first use. Actions call
 * this on every event rather than holding a reference, so a settings change
 * moves them to the right slot without any teardown of their own.
 */
function totalMixFor(options) {
    const key = `${options.host}:${options.sendPort}:${options.receivePort}`;
    let conn = pool.get(key);
    if (conn === undefined) {
        conn = new TotalMixConnection();
        pool.set(key, conn);
    }
    // connect() is idempotent per instance; fire-and-forget keeps call sites sync.
    void conn.connect(options);
    return conn;
}
/** Releases every pooled connection. Called on plugin shutdown. */
function disposeAll() {
    for (const conn of pool.values()) {
        conn.dispose();
    }
    pool.clear();
}
/** Default-slot connection, kept for tests and as the pool's slot-1 entry. */
const totalMix = new TotalMixConnection();
pool.set(`${DEFAULT_OPTIONS.host}:${DEFAULT_OPTIONS.sendPort}:${DEFAULT_OPTIONS.receivePort}`, totalMix);

/**
 * Direct selection of submix, bank position, bus and Quick Workspace.
 */
let Select = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.select" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        cleanup = new Map();
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "classic");
            await this.setup(ev.action, ev.payload.settings);
        }
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        async setup(target, settings) {
            const tm = totalMixFor(connectionOptions(settings));
            // Submix buttons show the active submix name, which is the one piece of
            // feedback that makes a bank of them usable at a glance.
            const render = () => {
                if ((settings.mode ?? "submix") !== "submix")
                    return;
                const name = tm.getString(LABEL_SUBMIX);
                if (name !== undefined)
                    void target.setTitle(name);
            };
            this.releaseFor(target.id);
            this.cleanup.set(target.id, [tm.subscribe(LABEL_SUBMIX, render)]);
            render();
        }
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
        }
        onKeyDown(ev) {
            const s = ev.payload.settings;
            const tm = totalMixFor(connectionOptions(s));
            const value = num(s.value, 0);
            switch (s.mode ?? "submix") {
                case "submix":
                    // Numbering starts at 0 for single channels.
                    tm.send(SET_SUBMIX, value);
                    return;
                case "bankStart":
                    tm.send(SET_BANK_START, value);
                    return;
                case "offsetInBank":
                    tm.send(SET_OFFSET_IN_BANK, value);
                    return;
                case "quickWorkspace":
                    // Valid range is 1..30.
                    tm.send(LOAD_QUICK_WORKSPACE, Math.min(Math.max(value, 1), 30));
                    return;
                case "snapshot":
                    // Snapshots are kOSCScaleToggle: 1.0 recalls. Range 1..8; the
                    // reversed grid indexing is handled inside addr.snapshot().
                    tm.toggle(snapshot(Math.min(Math.max(value, 1), 8)));
                    return;
                case "bus":
                    tm.toggle(bus(s.bus ?? "output"));
                    return;
                case "nav":
                    tm.send(this.navAddress(s.nav ?? "trackNext"), 1.0);
                    return;
            }
        }
        navAddress(nav) {
            switch (nav) {
                case "trackNext":
                    return TRACK_NEXT;
                case "trackPrev":
                    return TRACK_PREV;
                case "bankNext":
                    return BANK_NEXT;
                case "bankPrev":
                    return BANK_PREV;
            }
        }
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
        }
    });
    return _classThis;
})();

/**
 * Generic on/off control.
 *
 * Two scale types hide behind these parameters, per RME's table, and they need
 * opposite treatment:
 *
 * - kOSCScaleToggle (main/global/page-2/groups): sending 1.0 FLIPS the state and
 *   TotalMix reports the result. No read needed, no race with the GUI.
 * - kOSCScaleOnOff (page-1 per-strip mute/solo/phantom/cue): sending 1.0 means
 *   SET ON, 0.0 means SET OFF. To toggle, the cached state must be read and the
 *   inverse sent. Sending 1.0 here just re-mutes forever
 */
/** Page-1 per-strip parameters use kOSCScaleOnOff — see class comment. */
const ONOFF_PARAMETERS = new Set([
    "stripMute",
    "stripSolo",
    "stripPhantom",
    "stripCue",
]);
let Toggle = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.toggle" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        cleanup = new Map();
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "classic");
            await this.setup(ev.action, ev.payload.settings);
        }
        /**
         * Settings changes arrive as their own event, not as a re-appear. Without this
         * handler the action keeps the address and icons captured at appearance — so a
         * dropdown change would keep showing (and toggling!) the previous parameter
         * until the profile switches.
         */
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        async setup(target, settings) {
            const tm = totalMixFor(connectionOptions(settings));
            const address = this.addressFor(settings);
            const icons = iconFor(settings.parameter ?? "mainDim");
            // Pinned strip toggles read from their own view's retained slice, so the
            // light stays correct even while the slot is parked on another bus.
            const pinnedBus = settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
                ? settings.bus
                : undefined;
            const pinnedBank = settings.bankStart !== undefined && String(settings.bankStart).trim() !== ""
                ? num(settings.bankStart, 0)
                : undefined;
            const isStripParam = String(settings.parameter ?? "mainDim").startsWith("strip");
            const req = isStripParam
                ? {
                    ...(pinnedBus !== undefined ? { bus: pinnedBus } : {}),
                    ...(pinnedBank !== undefined ? { bank: pinnedBank } : {}),
                }
                : null;
            if (req !== null && (req.bus !== undefined || req.bank !== undefined)) {
                tm.requireView(req);
            }
            const render = () => {
                const on = asBool(tm.get(address, req) ?? 0);
                // setState exists on keys only; a dial-placed toggle shows text instead.
                if (target.isKey()) {
                    // The manifest can only declare one generic On/Off pair, so the
                    // parameter-specific artwork is applied here.
                    void target.setImage(on ? icons.on : icons.off);
                    void target.setState(on ? 1 : 0);
                }
                else {
                    void target.setFeedback({ value: on ? "On" : "Off" });
                }
            };
            // Releasing first is what makes this safe to call on every settings
            // change: the old address's subscription is dropped before the new one
            // is added, so a re-parametered button cannot be driven by both.
            this.releaseFor(target.id);
            this.cleanup.set(target.id, [
                tm.subscribe(address, render),
                tm.onConnectionChange(render),
            ]);
            render();
        }
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
        }
        async onSendToPlugin(ev) {
            streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
            if (datasourceEvent(ev.payload) !== "getStrips")
                return;
            const settings = await ev.action.getSettings();
            const tm = totalMixFor(connectionOptions(settings));
            await replyStripDatasource(tm, "getStrips", settings, false);
        }
        onKeyDown(ev) {
            const tm = totalMixFor(connectionOptions(ev.payload.settings));
            const parameter = ev.payload.settings.parameter ?? "mainDim";
            const address = this.addressFor(ev.payload.settings);
            // Strip parameters address "the Nth fader currently shown" relative to
            // bus and bank. Pinning both first turns a relative button into an
            // absolute one: same channel every time, regardless of where the mixer
            // was left. Messages are sent back-to-back; TotalMix processes in order.
            if (ONOFF_PARAMETERS.has(parameter)) {
                const s = ev.payload.settings;
                if (s.bus === "input" || s.bus === "playback" || s.bus === "output") {
                    tm.toggle(bus(s.bus));
                }
                if (s.bankStart !== undefined && String(s.bankStart).trim() !== "") {
                    tm.send(SET_BANK_START, num(s.bankStart, 0));
                }
            }
            if (ONOFF_PARAMETERS.has(parameter)) {
                // kOSCScaleOnOff: the value IS the state. Invert what we last saw —
                // read from this strip's own view slice, since the bus/bank pins above
                // have already been sent and the write lands on that view. With no
                // cached state yet, turn on (matches user intent on a first press).
                const s2 = ev.payload.settings;
                const req = {
                    ...(s2.bus === "input" || s2.bus === "playback" || s2.bus === "output"
                        ? { bus: s2.bus }
                        : {}),
                    ...(s2.bankStart !== undefined && String(s2.bankStart).trim() !== ""
                        ? { bank: num(s2.bankStart, 0) }
                        : {}),
                };
                const next = asBool(tm.get(address, req) ?? 0) ? 0 : 1;
                streamDeck.logger.info(`Key press: set ${address} = ${next}`);
                tm.sendOffPage(address, next);
                return;
            }
            streamDeck.logger.info(`Key press: toggle ${address}`);
            tm.toggle(address);
        }
        addressFor(settings) {
            const strip = num(settings.strip, 1);
            const index = num(settings.index, 1);
            switch (settings.parameter ?? "mainDim") {
                case "mainDim":
                    return MAIN_DIM;
                case "mainMono":
                    return MAIN_MONO;
                case "mainMuteFx":
                    return MAIN_MUTE_FX;
                case "mainSpeakerB":
                    return MAIN_SPEAKER_B;
                case "mainTalkback":
                    return MAIN_TALKBACK;
                case "mainExtIn":
                    return MAIN_EXT_IN;
                case "mainRecall":
                    return MAIN_RECALL;
                case "globalMute":
                    return GLOBAL_MUTE;
                case "globalSolo":
                    return GLOBAL_SOLO;
                case "trim":
                    return TRIM;
                case "stripMute":
                    return mute(strip);
                case "stripSolo":
                    return solo(strip);
                case "stripPhantom":
                    return phantom(strip);
                case "stripCue":
                    return cue(strip);
                case "channelMute":
                    return CH_MUTE;
                case "channelSolo":
                    return CH_SOLO;
                case "channelPhantom":
                    return CH_PHANTOM;
                case "channelEq":
                    return CH_EQ_ENABLE;
                case "channelLowcut":
                    return CH_LOWCUT_ENABLE;
                case "channelComp":
                    return CH_COMP_ENABLE;
                case "muteGroup":
                    return muteGroup(index);
                case "soloGroup":
                    return soloGroup(index);
                case "faderGroup":
                    return faderGroup(index);
                case "snapshot":
                    return snapshot(index);
                case "reverb":
                    return REVERB_ENABLE;
                case "echo":
                    return ECHO_ENABLE;
                case "roomEq":
                    // Page 4; sending it also selects the Output bus per RME's table.
                    return ROOM_EQ_ENABLE;
            }
        }
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
        }
    });
    return _classThis;
})();

/**
 * Value stepping for dials and nudge keys.
 *
 * Kept out of the action files, which carry the `@action` decorator and import
 * the Stream Deck SDK. Pure functions here are testable without the SDK or the
 * decorator transform.
 */
/**
 * Fallback preamp span. Gain is kOSCScaleLin01 over a device-dependent range;
 * callers pass the device span where known (see totalmix/devices.ts). Displayed
 * values come from TotalMix's own string regardless.
 */
const GAIN_ASSUMED_RANGE_DB = 65;
/** FX steps 2% of range per detent — fine enough for time and frequency knobs. */
const FX_STEP = 0.02;
/**
 * Computes the next wire value for a continuous target.
 *
 * Faders step in dB along RME's curve — that curve is specific to mix faders and
 * must not be applied to the others. Gain and FX are linear on the wire.
 */
function computeNext(kind, current, ticks, dbStep, fxFraction, gainRangeDb = GAIN_ASSUMED_RANGE_DB) {
    switch (kind) {
        case "fader":
            return stepDb(current, ticks * dbStep);
        case "gain":
            // A zero or negative span would make the step infinite or inverted.
            return clamp01(current + (ticks * dbStep) / (gainRangeDb > 0 ? gainRangeDb : GAIN_ASSUMED_RANGE_DB));
        case "fx":
            return clamp01(current + ticks * fxFraction);
    }
}
/**
 * Rounds TotalMix's gain display string to a whole number, keeping the unit
 * ("60.0 dB" -> "60 dB").
 *
 * The unit is carried over from the source rather than hardcoded, so a device
 * reporting other than dB shows its own. Strings with no leading number ("n/a",
 * "-oo") pass through unchanged.
 */
function formatGain(val) {
    const m = val.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*(.*)$/);
    if (m?.[1] === undefined)
        return val;
    const unit = (m[2] ?? "").trim() || "dB";
    return `${Math.round(Number(m[1]))} ${unit}`;
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Step per detent when the user has not set one. Coarse enough to cross the throw in a few turns, fine enough to trim a monitor level. */
const DEFAULT_STEP_DB = 1.5;
/** Re-pin bus/bank at most this often per action — once per gesture, not per tick. */
const PIN_INTERVAL_MS = 400;
/**
 * Continuous FX parameters, all linear 0..1 on the wire (lowcut frequency is on
 * TotalMix's log curve, but as we step the wire value and display TotalMix's own
 * Val string, the same linear stepping applies cleanly). Press toggles the
 * parameter's natural enable. Displays use the Val string, so units (ms, Hz, %)
 * are always TotalMix's truth.
 */
const FX_TARGETS = {
    fxReverbSend: { address: CH_REVERB_SEND, press: REVERB_ENABLE, label: "Rev Send" },
    fxReverbReturn: { address: CH_REVERB_RETURN, press: REVERB_ENABLE, label: "Rev Return" },
    fxReverbVolume: { address: REVERB_VOLUME, press: REVERB_ENABLE, label: "Reverb Vol" },
    fxReverbTime: { address: REVERB_TIME, press: REVERB_ENABLE, label: "Rev Time" },
    fxReverbPredelay: { address: REVERB_PREDELAY, press: REVERB_ENABLE, label: "Predelay" },
    fxReverbWidth: { address: REVERB_WIDTH, press: REVERB_ENABLE, label: "Rev Width" },
    fxEchoVolume: { address: ECHO_VOLUME, press: ECHO_ENABLE, label: "Echo Vol" },
    fxEchoDelay: { address: ECHO_DELAY, press: ECHO_ENABLE, label: "Echo Delay" },
    fxEchoFeedback: { address: ECHO_FEEDBACK, press: ECHO_ENABLE, label: "Feedback" },
    fxLowcutFreq: { address: CH_LOWCUT_FREQ, press: CH_LOWCUT_ENABLE, label: "Low Cut" },
};
/** Narrows a settings string to an FX target, so FX_TARGETS can be indexed safely. */
const isFx = (t) => t in FX_TARGETS;
/**
 * Which stepping law a target obeys. Only mix faders follow RME's dB curve;
 * gain and FX are linear on the wire, and applying the fader curve to them
 * would make their steps wrong at both ends of the range.
 */
const kindOf = (target) => isFx(target) ? "fx" : target === "gain" ? "gain" : "fader";
/**
 * Volume control for a key or a Stream Deck+ dial.
 *
 * Rotation steps a fixed number of dB rather than a fixed amount of the 0..1 wire
 * value, because the TotalMix fader curve is strongly non-linear — a linear step
 * moves 4.4x further in dB at the bottom of the throw than at the top.
 */
let Volume = (() => {
    let _classDecorators = [action({ UUID: "de.shellsdw.totalmix2.volume" })];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = SingletonAction;
    (class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        /** Unsubscribe callbacks, keyed by action id, released on disappear. */
        cleanup = new Map();
        /** Last bus/bank pin per action id, to rate-limit pinning during dial bursts. */
        lastPin = new Map();
        /**
         * Strip addresses are relative to bus and bank. When the settings pin either,
         * assert them before acting — but during a dial burst only on the first tick
         * of the gesture, since rotation events arrive far faster than the view can
         * meaningfully change underneath them.
         */
        pinIfConfigured(tm, id, settings, force = false) {
            const target = settings.target ?? "main";
            if (target !== "strip" && target !== "gain")
                return; // FX targets need no pinning
            const now = Date.now();
            if (!force && now - (this.lastPin.get(id) ?? 0) < PIN_INTERVAL_MS)
                return;
            this.lastPin.set(id, now);
            if (target === "gain") {
                // Gain only exists on the input bus — always pin it, ignoring any bus
                // setting, so the dial cannot silently tweak a playback/output strip.
                tm.toggle(bus("input"));
            }
            else if (settings.bus === "input" || settings.bus === "playback" || settings.bus === "output") {
                tm.toggle(bus(settings.bus));
            }
            if (settings.bankStart !== undefined && String(settings.bankStart).trim() !== "") {
                tm.send(SET_BANK_START, num(settings.bankStart, 0));
            }
        }
        /**
         * Seeds the user's saved defaults into a freshly placed button before wiring
         * it up, so a new key inherits their host, ports and step rather than the
         * factory ones.
         */
        async onWillAppear(ev) {
            await seedDefaults(ev.action, ev.payload.settings, "classic", { stepDb: true });
            await this.setup(ev.action, ev.payload.settings);
        }
        /** Re-run setup when the user changes settings in the property inspector. */
        async onDidReceiveSettings(ev) {
            await this.setup(ev.action, ev.payload.settings);
        }
        /**
         * (Re)binds one button to the connection and addresses its settings imply.
         *
         * Runs on appear and on every settings change, so it must be idempotent: the
         * previous subscriptions are released at the end, once the new ones exist.
         */
        async setup(target, settings) {
            const tm = totalMixFor(connectionOptions(settings));
            const address = this.addressFor(settings);
            const display = displayOf(address);
            const render = () => {
                void this.render(tm, target, settings);
            };
            const unsubs = [
                tm.subscribe(address, render),
                tm.subscribe(display, render),
                tm.onConnectionChange(render),
            ];
            // The title comes from trackname/channel-name addresses that arrive in
            // the page dump in their own order — often after this action's value.
            // Without subscribing to them, a name landing late never triggers a
            // re-render and the "Strip N" fallback sticks until something else moves.
            const tgt = settings.target ?? "main";
            if (tgt === "strip" || tgt === "gain") {
                unsubs.push(tm.subscribe(trackName(num(settings.strip, 1)), render));
            }
            else if (tgt === "channel") {
                unsubs.push(tm.subscribe(CH_TRACK_NAME, render));
            }
            // Register this dial's view for startup priming. The connection visits
            // every required view once, serially, filling each slice, so values and
            // names are prefilled without appear-time pin races.
            const startupReq = this.requiredView(settings);
            if (startupReq !== null)
                tm.requireView(startupReq);
            // Replace any subscriptions left over from a previous appearance or from
            // the previous settings — old-address subscriptions must not linger.
            this.releaseFor(target.id);
            this.cleanup.set(target.id, unsubs);
            render();
        }
        /** Drops subscriptions when the button leaves the screen — profile switches would otherwise accumulate them. */
        onWillDisappear(ev) {
            this.releaseFor(ev.action.id);
        }
        /**
         * Answers the property inspector's request for the channel dropdown, filling
         * it from live cache so the user picks real channel names instead of numbers.
         */
        async onSendToPlugin(ev) {
            // Always log what the PI sends: whether this line appears is the fact that
            // splits "request never arrives" from "reply is wrong" when the channel
            // dropdown misbehaves.
            streamDeck.logger.info(`PI -> plugin: ${JSON.stringify(ev.payload).slice(0, 160)}`);
            if (datasourceEvent(ev.payload) !== "getStrips")
                return;
            const settings = await ev.action.getSettings();
            const tm = totalMixFor(connectionOptions(settings));
            await replyStripDatasource(tm, "getStrips", settings, (settings.target ?? "main") === "gain");
        }
        /**
         * Steps the value by the configured amount per detent — dB for faders and
         * gain, a fixed fraction of range for FX — and repaints optimistically.
         *
         * Writes are coalesced, so spinning fast costs one datagram per tick window
         * rather than one per detent.
         */
        onDialRotate(ev) {
            const settings = ev.payload.settings;
            const tm = totalMixFor(connectionOptions(settings));
            const req = this.requiredView(settings);
            // Pin hard when the slot is parked elsewhere: the write below must land on
            // this dial's view, and message ordering guarantees the bus/bank selects
            // are processed first.
            this.pinIfConfigured(tm, ev.action.id, settings, req !== null && !tm.viewMatches(req));
            const target = settings.target ?? "main";
            const address = this.addressFor(settings);
            const perTick = target === "gain" ? DEFAULT_STEP_DB : num(settings.stepDb, DEFAULT_STEP_DB);
            // The value is read from this dial's view slice, retained per bus/bank, so
            // it is this channel's own last value even while the slot is parked
            // elsewhere. A flat cache would be wrong here: another bus's dump carries
            // zeros for micgain. Only a view that has never delivered data blocks the
            // gesture.
            if (tm.get(address, req) === undefined) {
                streamDeck.logger.warn(`Ignoring dial move on ${address}: no data for its view yet`);
                tm.requestFullRefresh();
                return;
            }
            const current = tm.getNumber(address, 0, req);
            const next = computeNext(kindOf(target), current, ev.payload.ticks, perTick, FX_STEP, gainRangeDb(settings.device));
            // Coalesced: rotation fires far faster than TotalMix needs telling, and only
            // the latest position matters.
            tm.sendCoalesced(address, next);
            void this.render(tm, ev.action, settings, next);
        }
        /** Pressing the dial mutes — the obvious gesture for a monitor level. */
        onDialDown(ev) {
            const tm = totalMixFor(connectionOptions(ev.payload.settings));
            this.pinIfConfigured(tm, ev.action.id, ev.payload.settings);
            this.toggleMute(tm, ev.payload.settings);
        }
        /**
         * On a key (no dial), each press nudges the value by the configured step in
         * the configured direction — the only way to set a level on non-+ decks.
         * The step setting applies as dB for faders and gain, and as percentage
         * points of range for FX. Mute on keys belongs to the Toggle action.
         */
        onKeyDown(ev) {
            const settings = ev.payload.settings;
            const tm = totalMixFor(connectionOptions(settings));
            this.pinIfConfigured(tm, ev.action.id, settings);
            const target = settings.target ?? "main";
            const address = this.addressFor(settings);
            const ticks = (settings.nudge ?? "up") === "down" ? -1 : 1;
            const dbStep = num(settings.stepDb, DEFAULT_STEP_DB);
            // Same view scoping as dial rotation — see the comment there.
            const reqView = this.requiredView(settings);
            if (reqView !== null && !tm.viewMatches(reqView)) {
                this.pinIfConfigured(tm, ev.action.id, settings, true);
            }
            if (tm.get(address, reqView) === undefined) {
                streamDeck.logger.warn(`Ignoring nudge on ${address}: no data for its view yet`);
                tm.requestFullRefresh();
                return;
            }
            const current = tm.getNumber(address, 0, reqView);
            const next = computeNext(kindOf(target), current, ticks, dbStep, dbStep / 100, gainRangeDb(settings.device));
            streamDeck.logger.info(`Key press: nudge ${address} ${ticks > 0 ? "+" : "-"}${dbStep}`);
            tm.sendOffPage(address, next);
            void this.render(tm, ev.action, settings, next);
        }
        /**
         * The press gesture, whose meaning follows the target: each one's closest
         * equivalent of "silence this", since not every target has a plain mute.
         */
        toggleMute(tm, settings) {
            const target = settings.target ?? "main";
            if (isFx(target)) {
                // FX dials press-toggle their parameter's natural enable.
                tm.toggle(FX_TARGETS[target].press);
                return;
            }
            if (target === "main") {
                // Main out has no plain mute; dim is the equivalent monitoring gesture.
                tm.toggle(MAIN_DIM);
                return;
            }
            if (target === "channel") {
                tm.toggle(CH_MUTE);
                return;
            }
            // "strip" and "gain" both press-mute the strip.
            // Per-strip mute is kOSCScaleOnOff, not a toggle: invert the cached state.
            const address = mute(num(settings.strip, 1));
            tm.sendOffPage(address, asBool(tm.get(address) ?? 0) ? 0 : 1);
        }
        /**
         * The OSC address this button controls. Falls back to main volume for an
         * unrecognised target, so settings written by an older build stay harmless
         * rather than addressing nothing.
         */
        addressFor(settings) {
            const target = settings.target ?? "main";
            switch (target) {
                case "main":
                    return MAIN_VOLUME;
                case "channel":
                    return CH_VOLUME;
                case "strip":
                    return volume(num(settings.strip, 1));
                case "gain":
                    return micGain(num(settings.strip, 1));
                default:
                    return isFx(target) ? FX_TARGETS[target].address : MAIN_VOLUME;
            }
        }
        /**
         * The view this action's settings require, or null if it needs no particular
         * one.
         *
         * Gain is always input-bus regardless of the bus setting, because the preamp
         * only exists there. Strips require a view only when the user pinned a bus or
         * bank; unpinned, they follow whatever the slot shows, which is the point of
         * leaving those settings empty. Main, channel and FX targets are not
         * positional at all and so require nothing.
         */
        requiredView(settings) {
            const tgt = settings.target ?? "main";
            const bank = settings.bankStart !== undefined && String(settings.bankStart).trim() !== ""
                ? num(settings.bankStart, 0)
                : undefined;
            if (tgt === "gain") {
                return bank !== undefined ? { bus: "input", bank } : { bus: "input" };
            }
            if (tgt === "strip") {
                const bus = settings.bus === "input" || settings.bus === "playback" || settings.bus === "output"
                    ? settings.bus
                    : undefined;
                if (bus === undefined && bank === undefined)
                    return null;
                return { ...(bus !== undefined ? { bus } : {}), ...(bank !== undefined ? { bank } : {}) };
            }
            return null;
        }
        /**
         * Paints the key or dial from cache.
         *
         * Prefers TotalMix's own "...Val" display string over a locally computed one:
         * TotalMix is authoritative about how it formats a level, and matching it keeps
         * the Stream Deck consistent with the on-screen mixer.
         *
         * `override` is the value just written by a gesture, shown before TotalMix
         * confirms it so the dial tracks the finger rather than the network.
         */
        async render(tm, target, settings, override) {
            const address = this.addressFor(settings);
            const tgt = settings.target ?? "main";
            const isGain = tgt === "gain";
            // Reads are scoped to the view this dial REQUIRES, not whatever view is
            // current — retained values from its own bus keep showing (with the right
            // channel names) while another dial has the slot parked elsewhere. The
            // placeholder only appears when that view has never delivered data.
            const req = this.requiredView(settings);
            if (override === undefined && tm.get(address, req) === undefined) {
                if (target.isDial()) {
                    await target.setFeedback({
                        title: this.labelFor(tm, settings),
                        value: "—",
                        indicator: { value: 0 },
                    });
                }
                else {
                    await target.setTitle("—");
                }
                return;
            }
            const value = override ?? tm.getNumber(address, 0, req);
            // The Val string is TotalMix's own formatting and, for gain, the only
            // meaningful display: the 0..1 wire value has no fixed dB meaning. Gain
            // is rounded to a whole number and keeps its unit ("60 dB").
            const raw = tm.getString(displayOf(address), req);
            const label = raw !== undefined
                ? isGain
                    ? formatGain(raw)
                    : raw
                : isGain || isFx(tgt)
                    ? `${Math.round(value * 100)} %`
                    : formatDb(value);
            const name = this.labelFor(tm, settings);
            if (target.isDial()) {
                await target.setFeedback({
                    title: name,
                    value: tm.connected ? label : "—",
                    indicator: { value: faderToBar(value) },
                });
                return;
            }
            await target.setTitle(tm.connected ? label : "—");
        }
        /**
         * The title shown above the value. Prefers the channel name TotalMix
         * reports — read through this action's own view, so it is this strip's name
         * even when the slot is parked on another bus — and falls back to a
         * positional label until that name arrives.
         */
        labelFor(tm, settings) {
            const req = this.requiredView(settings);
            const target = settings.target ?? "main";
            switch (target) {
                case "main":
                    return "Main";
                case "channel":
                    return tm.getString(CH_TRACK_NAME) ?? "Channel";
                case "strip":
                    return (tm.getString(trackName(num(settings.strip, 1)), req) ??
                        `Strip ${num(settings.strip, 1)}`);
                case "gain":
                    return (tm.getString(trackName(num(settings.strip, 1)), req) ??
                        `Gain ${num(settings.strip, 1)}`);
                default:
                    return isFx(target) ? FX_TARGETS[target].label : "Main";
            }
        }
        /** Runs and forgets one button's unsubscribe callbacks. Safe to call twice. */
        releaseFor(id) {
            const unsubs = this.cleanup.get(id);
            if (unsubs === undefined)
                return;
            for (const fn of unsubs)
                fn();
            this.cleanup.delete(id);
        }
    });
    return _classThis;
})();

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
//# sourceMappingURL=plugin.js.map
