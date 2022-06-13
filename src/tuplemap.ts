export class TupleMap<Key extends readonly any[], Value> {
  identifierMap = new Map<any, [number, number]>()
  internalEntries = new Map<string, readonly [Readonly<Key>, Value]>()
  lastId = 0
  addKey(key: Readonly<Key>) {
    const { identifierMap } = this
    return key.map(item => {
      let entry = identifierMap.get(item)
      if (!entry) identifierMap.set(item, entry = [this.lastId++, 0])
      entry[1]++
      return entry[0]
    }).join('/')
  }
  keyToString(key: Readonly<Key>) {
    const { identifierMap } = this
    const ids: number[] = []
    for (const item of key) {
      const entry = identifierMap.get(item)
      if (!entry) return
      ids.push(entry[0])
    }
    return ids.join('/')
  }
  deleteKey(key: Readonly<Key>) {
    for (const item of key) {
      const entry = this.identifierMap.get(item)!
      entry[1]--
      if (entry[1] === 0) this.identifierMap.delete(item)
    }
  }
  set(key: Readonly<Key>, value: Value) {
    let skey = this.keyToString(key)
    if (skey == null || !this.internalEntries.has(skey)) skey = this.addKey(key)
    this.internalEntries.set(skey, [key, value])
    return this
  }
  get(key: Readonly<Key>) {
    const skey = this.keyToString(key)
    if (skey) return this.internalEntries.get(skey)?.[1]
  }
  has(key: Readonly<Key>) {
    const skey = this.keyToString(key)
    return skey != null && this.internalEntries.has(skey)
  }
  delete(key: Readonly<Key>) {
    const skey = this.keyToString(key)
    if (skey != null && this.internalEntries.delete(skey)) {
      this.deleteKey(key)
      return true
    }
    return false
  }
  [Symbol.iterator]() {
    return this.entries()
  }
  *entries(): IterableIterator<readonly [Readonly<Key>, Value]> {
    for (const [, entry] of this.internalEntries) yield entry
  }
  *keys(): IterableIterator<Readonly<Key>> {
    for (const [, [key]] of this.internalEntries) yield key
  }
  *values(): IterableIterator<Value> {
    for (const [, [, value]] of this.internalEntries) yield value
  }
  forEach(f: (value: Value, key: Readonly<Key>) => void) {
    for (const [, [key, value]] of this.internalEntries) f(value, key)
  }
  get size() {
    return this.internalEntries.size
  }
  clear() {
    this.lastId = 0
    this.identifierMap.clear()
    this.internalEntries.clear()
  }
}
