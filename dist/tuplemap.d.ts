export declare class TupleMap<Key extends readonly any[], Value> {
    identifierMap: Map<any, [number, number]>;
    internalEntries: Map<string, readonly [Readonly<Key>, Value]>;
    lastId: number;
    addKey(key: Readonly<Key>): string;
    keyToString(key: Readonly<Key>): string | undefined;
    deleteKey(key: Readonly<Key>): void;
    set(key: Readonly<Key>, value: Value): this;
    get(key: Readonly<Key>): Value | undefined;
    has(key: Readonly<Key>): boolean;
    delete(key: Readonly<Key>): boolean;
    [Symbol.iterator](): IterableIterator<readonly [Readonly<Key>, Value]>;
    entries(): IterableIterator<readonly [Readonly<Key>, Value]>;
    keys(): IterableIterator<Readonly<Key>>;
    values(): IterableIterator<Value>;
    forEach(f: (value: Value, key: Readonly<Key>) => void): void;
    get size(): number;
    clear(): void;
}
