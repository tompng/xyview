"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TupleMap = void 0;
class TupleMap {
    constructor() {
        this.identifierMap = new Map();
        this.internalEntries = new Map();
        this.lastId = 0;
    }
    addKey(key) {
        const { identifierMap } = this;
        return key.map(item => {
            let entry = identifierMap.get(item);
            if (!entry)
                identifierMap.set(item, entry = [this.lastId++, 0]);
            entry[1]++;
            return entry[0];
        }).join('/');
    }
    keyToString(key) {
        const { identifierMap } = this;
        const ids = [];
        for (const item of key) {
            const entry = identifierMap.get(item);
            if (!entry)
                return;
            ids.push(entry[0]);
        }
        return ids.join('/');
    }
    deleteKey(key) {
        for (const item of key) {
            const entry = this.identifierMap.get(item);
            entry[1]--;
            if (entry[1] === 0)
                this.identifierMap.delete(item);
        }
    }
    set(key, value) {
        let skey = this.keyToString(key);
        if (skey == null || !this.internalEntries.has(skey))
            skey = this.addKey(key);
        this.internalEntries.set(skey, [key, value]);
        return this;
    }
    get(key) {
        var _a;
        const skey = this.keyToString(key);
        if (skey != null)
            return (_a = this.internalEntries.get(skey)) === null || _a === void 0 ? void 0 : _a[1];
    }
    has(key) {
        const skey = this.keyToString(key);
        return skey != null && this.internalEntries.has(skey);
    }
    delete(key) {
        const skey = this.keyToString(key);
        if (skey != null && this.internalEntries.delete(skey)) {
            this.deleteKey(key);
            return true;
        }
        return false;
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    *entries() {
        for (const [, entry] of this.internalEntries)
            yield entry;
    }
    *keys() {
        for (const [, [key]] of this.internalEntries)
            yield key;
    }
    *values() {
        for (const [, [, value]] of this.internalEntries)
            yield value;
    }
    forEach(f) {
        for (const [, [key, value]] of this.internalEntries)
            f(value, key);
    }
    get size() {
        return this.internalEntries.size;
    }
    clear() {
        this.lastId = 0;
        this.identifierMap.clear();
        this.internalEntries.clear();
    }
}
exports.TupleMap = TupleMap;
