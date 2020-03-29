import hash_sum from 'hash-sum';
import { nanoid } from 'nanoid/non-secure';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global Reflect, Promise */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
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
}

var RPCError = /** @class */ (function (_super) {
    __extends(RPCError, _super);
    function RPCError(message, code) {
        var _this = _super.call(this, message) || this;
        _this.code = code || 0;
        _this.message = message;
        return _this;
    }
    RPCError.prototype.toString = function () {
        return this.message;
    };
    return RPCError;
}(Error));
var RPC = /** @class */ (function () {
    function RPC(send, timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = 5000; }
        this._timeout = 5000;
        this._promises = new Map();
        this._callings = new Map();
        this._patterns = [];
        this._hashedFunctions = new Map();
        this._remoteObjects = new Map();
        this._remoteObjectClusters = new Map();
        this.extendedRPCs = [];
        this.send = send;
        this._timeout = timeout || 5000;
        this.on('_.Function.call', function (hash, params) { return __awaiter(_this, void 0, void 0, function () {
            var f;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._hashedFunctions.has(hash)) return [3 /*break*/, 2];
                        f = this._hashedFunctions.get(hash);
                        return [4 /*yield*/, Promise.resolve(f.apply(void 0, params))];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [2 /*return*/];
                }
            });
        }); });
        this.on('_.Function.release', function (hash) {
            if (_this._hashedFunctions.has(hash)) {
                _this._hashedFunctions.delete(hash);
            }
        });
        this.on('_.RemoteObject.set', function (remoteId, path, value) {
            try {
                var obj = _this._remoteObjects.get(remoteId);
                var props = path.split('.');
                var lastProp = props.pop();
                var o = obj;
                for (var _i = 0, props_1 = props; _i < props_1.length; _i++) {
                    var p = props_1[_i];
                    o = Reflect.get(o, p);
                }
                Reflect.set(o, lastProp, value);
            }
            catch (e) {
                console.debug(e);
            }
        });
        this.on('_.RemoteObject.get', function (remoteId) { return __awaiter(_this, void 0, void 0, function () {
            var obj, _a, _b, _c, _d, e_1;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        obj = this._remoteObjects.get(remoteId);
                        _b = (_a = JSON).parse;
                        _d = (_c = JSON).stringify;
                        return [4 /*yield*/, Promise.resolve(obj)];
                    case 1: return [2 /*return*/, _b.apply(_a, [_d.apply(_c, [_e.sent()])])];
                    case 2:
                        e_1 = _e.sent();
                        console.debug(e_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        this.on('_.RemoteObject.apply', function (remoteId, path, params) { return __awaiter(_this, void 0, void 0, function () {
            var obj, passToRemote, props, lastProp, o, _i, props_2, p, ret, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        obj = this._remoteObjects.get(remoteId);
                        passToRemote = void 0, props = void 0;
                        if (path.slice(-1) === '$') {
                            props = path.slice(0, -1).split('.');
                            passToRemote = true;
                        }
                        else {
                            props = path.split('.');
                            passToRemote = false;
                        }
                        lastProp = props.pop();
                        o = obj;
                        for (_i = 0, props_2 = props; _i < props_2.length; _i++) {
                            p = props_2[_i];
                            o = Reflect.get(o, p);
                        }
                        return [4 /*yield*/, Promise.resolve(Reflect.apply(o[lastProp], o, params))];
                    case 1:
                        ret = _b.sent();
                        if (passToRemote) {
                            return [2 /*return*/, JSON.parse(JSON.stringify(ret))];
                        }
                        return [2 /*return*/, this.makeRemoteObject(ret, remoteId)];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        this.on('_.RemoteObject.release', function (remoteId) {
            var cluster = _this._remoteObjectClusters.get(remoteId) || [];
            cluster.map(function (key) { return _this._remoteObjects.delete(key); });
            _this._remoteObjectClusters.delete(remoteId);
            return true;
        });
    }
    RPC.prototype.decodeFunctions = function (params) {
        var self = this;
        var _decode = function (param) {
            if (param === Object(param)) {
                if (param['@func'] === '1.0' && Reflect.has(param, 'hash')) {
                    return new Proxy(function () { }, {
                        get: function (target, prop) {
                            // 有可能被通过then来判断是否是个promise
                            var sProp = String(prop);
                            if (Reflect.has(target, prop)) {
                                return target[prop];
                            }
                            if (sProp === 'release') {
                                return function () {
                                    self.notify('_.Function.release', [param.hash]);
                                };
                            }
                        },
                        apply: function (_, __, params) {
                            self.notify('_.Function.call', [param.hash, params]);
                        },
                    });
                }
                else {
                    for (var k in param) {
                        if (param.hasOwnProperty(k)) {
                            param[k] = _decode(param[k]);
                        }
                    }
                }
            }
            else if (Array.isArray(param)) {
                return param.map(function (p) { return _decode(p); });
            }
            return param;
        };
        return _decode(params);
    };
    RPC.prototype.encodeFunctions = function (params) {
        var _this = this;
        var _encode = function (param) {
            if (typeof param === 'function') {
                var hash = hash_sum(param);
                _this._hashedFunctions.set(hash, param);
                return { '@func': '1.0', hash: hash };
            }
            else if (param === Object(param)) {
                for (var k in param) {
                    if (param.hasOwnProperty(k)) {
                        param[k] = _encode(param[k]);
                    }
                }
            }
            else if (Array.isArray(param)) {
                return param.map(function (p) { return _encode(p); });
            }
            return param;
        };
        return _encode(params);
    };
    RPC.prototype.makeRemoteObject = function (obj, remoteId) {
        var uniqid = nanoid();
        this._remoteObjects.set(uniqid, obj);
        var rootId = remoteId || uniqid;
        var cluster = this._remoteObjectClusters.get(rootId) || [];
        cluster.push(uniqid);
        this._remoteObjectClusters.set(rootId, cluster);
        return { '@remote': uniqid };
    };
    RPC.prototype.extends = function (rpc) {
        this.extendedRPCs.push(rpc);
    };
    RPC.prototype.getHandler = function (method) {
        var f, matches;
        if (this._callings.has(method)) {
            f = this._callings.get(method);
        }
        else {
            for (var _i = 0, _a = this._patterns; _i < _a.length; _i++) {
                var _b = _a[_i], pattern = _b.pattern, callback = _b.callback;
                matches = method.match(pattern);
                if (matches) {
                    f = callback;
                    break;
                }
            }
        }
        return [f, matches];
    };
    RPC.prototype.receive = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var method, params, remote, _a, f, matches, _i, _b, rpc, result, e_2, promise, promise, result, self_1, remoteId_1, RemoteObjectHandler_1, $$cache_1;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (request.jsonrpc !== '2.0') {
                            return [2 /*return*/, false];
                        }
                        if (!Reflect.has(request, 'method')) return [3 /*break*/, 5];
                        method = request.method, params = request.params;
                        remote = void 0;
                        if (method.slice(-1) === '$') {
                            // end with $, should return remote object
                            method = method.slice(0, -1);
                            remote = true;
                        }
                        else {
                            remote = false;
                        }
                        _a = this.getHandler(method), f = _a[0], matches = _a[1];
                        if (f === undefined && this.extendedRPCs.length > 0) {
                            for (_i = 0, _b = this.extendedRPCs; _i < _b.length; _i++) {
                                rpc = _b[_i];
                                _c = rpc.getHandler(method), f = _c[0], matches = _c[1];
                                if (f)
                                    break;
                            }
                        }
                        if (f === undefined) {
                            if (request.id) {
                                this.sendError(new RPCError("Method \"" + method + "\" not found", -32601), request.id);
                            }
                            return [2 /*return*/];
                        }
                        params = this.decodeFunctions(params);
                        if (!Array.isArray(params)) {
                            params = [params];
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        result = void 0;
                        if (matches) {
                            params = [params, matches];
                        }
                        return [4 /*yield*/, Promise.resolve(f.apply(void 0, params))];
                    case 2:
                        result = _d.sent();
                        if (remote) {
                            // encode result and add ref
                            result = this.makeRemoteObject(result);
                        }
                        if (request.id)
                            return [2 /*return*/, this.sendResult(result, request.id)];
                        return [3 /*break*/, 4];
                    case 3:
                        e_2 = _d.sent();
                        if (e_2 instanceof RPCError) {
                            return [2 /*return*/, this.sendError(e_2)];
                        }
                        else {
                            throw e_2;
                        }
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        if (Reflect.has(request, 'error')) {
                            if (request.id && this._promises.has(request.id)) {
                                promise = this._promises.get(request.id);
                                promise.reject(request.error);
                                clearTimeout(promise.timeout);
                                this._promises.delete(request.id);
                            }
                        }
                        else if (Reflect.has(request, 'result')) {
                            if (request.id && this._promises.has(request.id)) {
                                promise = this._promises.get(request.id);
                                result = request.result;
                                if (result && typeof result === 'object' && Reflect.has(result, '@remote')) {
                                    self_1 = this;
                                    remoteId_1 = result['@remote'];
                                    RemoteObjectHandler_1 = {
                                        set: function (target, prop, value) {
                                            var sProp = String(prop);
                                            var propName = target.$$baseName ? target.$$baseName + "." + sProp : sProp;
                                            self_1.call('_.RemoteObject.set', [remoteId_1, propName, value]);
                                            return true;
                                        },
                                        get: function (target, prop) {
                                            // 有可能被通过then来判断是否是个promise
                                            var sProp = String(prop);
                                            if (sProp === 'then' || sProp.slice(0, 1) === '$$') {
                                                return undefined;
                                            }
                                            if (Reflect.has(target, prop)) {
                                                return target[prop];
                                            }
                                            if (!Reflect.has(target.$$cache, prop)) {
                                                target.$$cache[prop] = new Proxy(Object.assign(function () { }, {
                                                    $$baseName: target.$$baseName ? target.$$baseName + "." + sProp : sProp,
                                                    $$cache: {},
                                                }), RemoteObjectHandler_1);
                                            }
                                            return target.$$cache[prop];
                                        },
                                        apply: function (target, _, params) {
                                            return self_1.call('_.RemoteObject.apply', [remoteId_1, target.$$baseName, params]);
                                        },
                                    };
                                    $$cache_1 = {};
                                    result = new Proxy(Object.assign(function () { }, {
                                        $$cache: $$cache_1,
                                        release$: function () {
                                            Object.keys($$cache_1).forEach(function (prop) { return delete $$cache_1[prop]; });
                                            return self_1.call('_.RemoteObject.release', [remoteId_1]);
                                        },
                                        get$: function () {
                                            return self_1.call('_.RemoteObject.get', [remoteId_1]);
                                        },
                                    }), RemoteObjectHandler_1);
                                }
                                promise.resolve(result);
                                clearTimeout(promise.timeout);
                                this._promises.delete(request.id);
                            }
                        }
                        _d.label = 6;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    RPC.prototype.sendResult = function (result, id) {
        var data = {
            jsonrpc: '2.0',
            result: result || null,
        };
        if (id)
            data.id = id;
        this.send(data);
        return this;
    };
    RPC.prototype.sendError = function (e, id) {
        var data = {
            jsonrpc: '2.0',
            error: {
                code: e.code,
                message: e.message,
            },
        };
        if (id)
            data.id = id;
        this.send(data);
        return this;
    };
    RPC.prototype.notify = function (method, params) {
        if (params === void 0) { params = {}; }
        params = this.encodeFunctions(params);
        this.send({
            jsonrpc: '2.0',
            method: method,
            params: params,
        });
    };
    RPC.prototype.call = function (method, params) {
        if (params === void 0) { params = {}; }
        params = this.encodeFunctions(params);
        var self = this;
        return new Promise(function (resolve, reject) {
            var id = nanoid();
            var data = {
                id: id,
                jsonrpc: '2.0',
                method: method,
                params: params,
            };
            self.send(data);
            self._promises.set(id, {
                resolve: resolve,
                reject: reject,
                timeout: setTimeout(function () {
                    self._promises.delete(id);
                    reject(new RPCError("Call " + method + " Timeout", -32603));
                }, self._timeout),
            });
        });
    };
    RPC.prototype.on = function (method, cb) {
        if (typeof method !== 'string') {
            this._patterns.push({
                pattern: method,
                callback: cb,
            });
        }
        else {
            this._callings.set(method, cb);
        }
        return this;
    };
    RPC.prototype.off = function (method) {
        if (typeof method !== 'string') {
            for (var key in this._callings.keys()) {
                if (key.match(method) != null)
                    this._callings.delete(key);
            }
            var str_1 = method.toString();
            this._patterns = this._patterns.filter(function (_a) {
                var pattern = _a.pattern;
                return pattern.toString() !== str_1;
            });
        }
        else {
            if (this._callings.has(method)) {
                this._callings.delete(method);
            }
        }
        return this;
    };
    RPC.Error = RPCError;
    return RPC;
}());

export default RPC;
