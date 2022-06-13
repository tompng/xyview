"use strict";
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TupleMap = void 0;
var TupleMap = /** @class */ (function () {
    function TupleMap() {
        this.identifierMap = new Map();
        this.internalEntries = new Map();
        this.lastId = 0;
    }
    TupleMap.prototype.addKey = function (key) {
        var _this = this;
        var identifierMap = this.identifierMap;
        return key.map(function (item) {
            var entry = identifierMap.get(item);
            if (!entry)
                identifierMap.set(item, entry = [_this.lastId++, 0]);
            entry[1]++;
            return entry[0];
        }).join('/');
    };
    TupleMap.prototype.keyToString = function (key) {
        var e_1, _a;
        var identifierMap = this.identifierMap;
        var ids = [];
        try {
            for (var key_1 = __values(key), key_1_1 = key_1.next(); !key_1_1.done; key_1_1 = key_1.next()) {
                var item = key_1_1.value;
                var entry = identifierMap.get(item);
                if (!entry)
                    return;
                ids.push(entry[0]);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (key_1_1 && !key_1_1.done && (_a = key_1.return)) _a.call(key_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return ids.join('/');
    };
    TupleMap.prototype.deleteKey = function (key) {
        var e_2, _a;
        try {
            for (var key_2 = __values(key), key_2_1 = key_2.next(); !key_2_1.done; key_2_1 = key_2.next()) {
                var item = key_2_1.value;
                var entry = this.identifierMap.get(item);
                entry[1]--;
                if (entry[1] === 0)
                    this.identifierMap.delete(item);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (key_2_1 && !key_2_1.done && (_a = key_2.return)) _a.call(key_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    TupleMap.prototype.set = function (key, value) {
        var skey = this.keyToString(key);
        if (skey == null || !this.internalEntries.has(skey))
            skey = this.addKey(key);
        this.internalEntries.set(skey, [key, value]);
        return this;
    };
    TupleMap.prototype.get = function (key) {
        var _a;
        var skey = this.keyToString(key);
        if (skey != null)
            return (_a = this.internalEntries.get(skey)) === null || _a === void 0 ? void 0 : _a[1];
    };
    TupleMap.prototype.has = function (key) {
        var skey = this.keyToString(key);
        return skey != null && this.internalEntries.has(skey);
    };
    TupleMap.prototype.delete = function (key) {
        var skey = this.keyToString(key);
        if (skey != null && this.internalEntries.delete(skey)) {
            this.deleteKey(key);
            return true;
        }
        return false;
    };
    TupleMap.prototype[Symbol.iterator] = function () {
        return this.entries();
    };
    TupleMap.prototype.entries = function () {
        var _a, _b, _c, entry, e_3_1;
        var e_3, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 5, 6, 7]);
                    _a = __values(this.internalEntries), _b = _a.next();
                    _e.label = 1;
                case 1:
                    if (!!_b.done) return [3 /*break*/, 4];
                    _c = __read(_b.value, 2), entry = _c[1];
                    return [4 /*yield*/, entry];
                case 2:
                    _e.sent();
                    _e.label = 3;
                case 3:
                    _b = _a.next();
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 7];
                case 5:
                    e_3_1 = _e.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 7];
                case 6:
                    try {
                        if (_b && !_b.done && (_d = _a.return)) _d.call(_a);
                    }
                    finally { if (e_3) throw e_3.error; }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    };
    TupleMap.prototype.keys = function () {
        var _a, _b, _c, _d, key, e_4_1;
        var e_4, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 5, 6, 7]);
                    _a = __values(this.internalEntries), _b = _a.next();
                    _f.label = 1;
                case 1:
                    if (!!_b.done) return [3 /*break*/, 4];
                    _c = __read(_b.value, 2), _d = __read(_c[1], 1), key = _d[0];
                    return [4 /*yield*/, key];
                case 2:
                    _f.sent();
                    _f.label = 3;
                case 3:
                    _b = _a.next();
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 7];
                case 5:
                    e_4_1 = _f.sent();
                    e_4 = { error: e_4_1 };
                    return [3 /*break*/, 7];
                case 6:
                    try {
                        if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
                    }
                    finally { if (e_4) throw e_4.error; }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    };
    TupleMap.prototype.values = function () {
        var _a, _b, _c, _d, value, e_5_1;
        var e_5, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 5, 6, 7]);
                    _a = __values(this.internalEntries), _b = _a.next();
                    _f.label = 1;
                case 1:
                    if (!!_b.done) return [3 /*break*/, 4];
                    _c = __read(_b.value, 2), _d = __read(_c[1], 2), value = _d[1];
                    return [4 /*yield*/, value];
                case 2:
                    _f.sent();
                    _f.label = 3;
                case 3:
                    _b = _a.next();
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 7];
                case 5:
                    e_5_1 = _f.sent();
                    e_5 = { error: e_5_1 };
                    return [3 /*break*/, 7];
                case 6:
                    try {
                        if (_b && !_b.done && (_e = _a.return)) _e.call(_a);
                    }
                    finally { if (e_5) throw e_5.error; }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    };
    TupleMap.prototype.forEach = function (f) {
        var e_6, _a;
        try {
            for (var _b = __values(this.internalEntries), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), _e = __read(_d[1], 2), key = _e[0], value = _e[1];
                f(value, key);
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_6) throw e_6.error; }
        }
    };
    Object.defineProperty(TupleMap.prototype, "size", {
        get: function () {
            return this.internalEntries.size;
        },
        enumerable: false,
        configurable: true
    });
    TupleMap.prototype.clear = function () {
        this.lastId = 0;
        this.identifierMap.clear();
        this.internalEntries.clear();
    };
    return TupleMap;
}());
exports.TupleMap = TupleMap;
