import hash_sum from 'hash-sum';

const customAlphabet = (alphabet) => {
    return (size) => {
        let id = '';
        // A compact alternative for `for (var i = 0; i < step; i++)`.
        let i = size;
        while (i--) {
            // `| 0` is more compact and faster than `Math.floor()`.
            id += alphabet[(Math.random() * alphabet.length) | 0];
        }
        return id;
    };
};

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz');

export class RPCError extends Error {
    public message: string;
    public code: number;

    public constructor(message: string, code: number) {
        super(message);
        this.code = code || 0;
        this.message = message;
    }

    public toString() {
        return this.message;
    }
}

export type RPCRequest = {
    jsonrpc: '2.0';
    id?: string;
    method: string;
    params: any | any[];
};

export type RPCResultResponse = {
    jsonrpc: '2.0';
    id?: string;
    result: any;
};

export type RPCErrorResponse = {
    jsonrpc: '2.0';
    id?: string;
    error: { code: number; message: string };
};

interface RPCPattern {
    pattern: RegExp;
    callback: Function;
}

interface RPCPromise {
    method: string;
    params: any[];
    resolve: Function;
    reject: Function;
    timeout: string;
}

type LogFn = (message?: any, ...optionalParams: any[]) => void;

export type RPCLogger = {
    info: LogFn;
    debug: LogFn;
    warn: LogFn;
    error: LogFn;
};

export type RPCSend = (data: RPCRequest | RPCResultResponse | RPCErrorResponse) => Promise<void> | void;
export type RPCOptions = { timeout?: number; logger?: RPCLogger; ready?: boolean };

const rpcTimeout: { [key: string]: { expires: number; callback: () => void } } = {};
let rpcTimeoutGC;

function setRPCTimeout(callback, timeout: number) {
    const timeoutId = nanoid(8);
    rpcTimeout[timeoutId] = {
        expires: Date.now() + timeout,
        callback,
    };
    if (!rpcTimeoutGC) {
        rpcTimeoutGC = setInterval(() => {
            const now = Date.now();
            Object.keys(rpcTimeout).forEach((timeoutId) => {
                const { expires, callback } = rpcTimeout[timeoutId];
                if (now >= expires) {
                    delete rpcTimeout[timeoutId];
                    callback();
                }
            });
        }, 500);
    }
    return timeoutId;
}

function clearRPCTimeout(timeoutId: string) {
    delete rpcTimeout[timeoutId];
    if (Object.keys(rpcTimeout).length == 0) {
        clearInterval(rpcTimeoutGC);
        rpcTimeoutGC = undefined;
    }
}

class RPC {
    public static Error = RPCError;
    public static isBuffer: Function;
    public static bufferEncode: Function;
    public static bufferDecode: Function;

    private _send: RPCSend;
    private _options: RPCOptions;
    private _promises: { [method: string]: RPCPromise } = {};
    private _callingHandlers: { [method: string]: { callback: Function; once: boolean } } = {};
    private _patterns: RPCPattern[] = [];

    private _hashedFunctions: { [hash: string]: Function } = {};
    private _remoteObjects: { [id: string]: any } = {};
    private _remoteObjectClusters: { [id: string]: string[] } = {};
    private _proxiedRemoteObjects: { [id: string]: boolean } = {};

    public constructor(send: RPCSend, options?: RPCOptions) {
        this._send = send;
        this._options = { timeout: 5000, ready: true, ...(options || {}) };

        this.on('_.Function.call', (hash: string, params: any[]) => {
            if (this._hashedFunctions.hasOwnProperty(hash)) {
                let f = this._hashedFunctions[hash];
                return Promise.resolve(f(...params));
            }
            return Promise.resolve();
        });

        this.on('_.Function.release', (hash: string) => {
            if (this._hashedFunctions.hasOwnProperty(hash)) {
                delete this._hashedFunctions[hash];
            }
        });

        this.on('_.RemoteObject.set', (remoteId: string, path: string, value: any) => {
            try {
                const obj = this._remoteObjects[remoteId];
                const props = path.split('.');
                const lastProp = props.pop();
                let o = obj;
                for (let p of props) {
                    o = Reflect.get(o, p);
                }
                Reflect.set(o, lastProp, value);
            } catch (e) {
                this._options.logger?.debug(e);
            }
        });

        this.on('_.RemoteObject.get', (remoteId: string) => {
            const obj = this._remoteObjects[remoteId];
            return Promise.resolve(obj)
                .then((o) => {
                    return JSON.parse(JSON.stringify(o));
                })
                .catch((e) => {
                    this._options.logger?.debug('_.RemoteObject.get error', e);
                });
        });

        this.on('_.RemoteObject.apply', (remoteId: string, path: string, params: any) => {
            const obj = this._remoteObjects[remoteId];
            let passToRemote, props;
            if (path.endsWith('$')) {
                props = path.slice(0, -1).split('.');
                passToRemote = true;
            } else {
                props = path.split('.');
                passToRemote = false;
            }
            const lastProp = props.pop();
            let o = obj;
            for (let p of props) {
                o = Reflect.get(o, p);
            }
            return Promise.resolve(Reflect.apply(o[lastProp], o, params)).then((ret) => {
                if (passToRemote) {
                    return JSON.parse(JSON.stringify(ret));
                }
                return this._makeRemoteObject(ret, remoteId);
            });
        });

        this.on('_.RemoteObject.release', (remoteId: string) => {
            const cluster = this._remoteObjectClusters[remoteId] || [];
            cluster.map((key) => delete this._remoteObjects[key]);
            delete this._remoteObjectClusters[remoteId];
            return true;
        });
    }

    public stat() {
        const objects = {};
        Object.keys(this._remoteObjectClusters).forEach((remoteId) => {
            objects[remoteId] = {};
            (this._remoteObjectClusters[remoteId] || []).forEach((key) => {
                objects[remoteId][key] = this._remoteObjects[key];
            });
        });
        return {
            functions: this._hashedFunctions,
            objects,
        };
    }

    public setTimeout(timeout: number) {
        this._options.timeout = timeout;
    }

    private _decodeNonScalars(params: any) {
        const self = this;

        const _decode = (param: any): any => {
            if (param === Object(param)) {
                if (param['@func'] === '1.0' && Reflect.has(param, 'hash')) {
                    let hash = param.hash;
                    return new Proxy(() => {}, {
                        get(target, prop) {
                            // 有可能被通过then来判断是否是个promise
                            const sProp = String(prop);
                            if (Reflect.has(target, prop)) {
                                return target[prop];
                            }
                            if (sProp === 'release') {
                                target.release = () => {
                                    self.notify('_.Function.release', [hash]);
                                    target.release = () => {};
                                    target.release.BEEN_CALLED = true;
                                };
                                return target.release;
                            }
                        },
                        apply(target, __, params) {
                            if (!target.release || target.release.BEEN_CALLED === undefined) {
                                return self.call('_.Function.call', [hash, params]);
                            }
                        },
                    } as ProxyHandler<any>);
                } else {
                    for (let k in param) {
                        param[k] = _decode(param[k]);
                    }
                }
            } else if (Array.isArray(param)) {
                return param.map((p) => _decode(p));
            } else if (RPC.bufferDecode && typeof param === 'string' && param.slice(0, 5) === '@buf:') {
                return RPC.bufferDecode(param.slice(5));
            }
            return param;
        };

        return _decode(params);
    }

    private _encodeNonScalars(params: any) {
        const _encode = (param: any): any => {
            if (typeof param === 'function') {
                let hash = hash_sum(param);
                this._hashedFunctions[hash] = param;
                return { '@func': '1.0', hash };
            } else if (RPC.isBuffer && RPC.bufferEncode && RPC.isBuffer(param)) {
                return '@buf:' + RPC.bufferEncode(param);
            } else if (Array.isArray(param)) {
                return param.map((p) => _encode(p));
            } else if (Object(param) === param) {
                for (let k in param) {
                    param[k] = _encode(param[k]);
                }
            }
            return param;
        };

        return _encode(params);
    }

    private _makeRemoteObject(obj: any, remoteId?: string) {
        const uniqid = nanoid(16);
        this._remoteObjects[uniqid] = obj;

        const rootId = remoteId || uniqid;
        const cluster = this._remoteObjectClusters[rootId] || [];
        cluster.push(uniqid);
        this._remoteObjectClusters[rootId] = cluster;

        return { '@remote': uniqid };
    }

    private _extendedRPCs: RPC[] = [];
    public extends(rpc: RPC) {
        if (!this._extendedRPCs.some(it => it === rpc)) {
            this._extendedRPCs.push(rpc);
        }
    }

    private _getHandler(method: string): [Function, RegExpMatchArray?] {
        const key = method.toLowerCase();
        if (this._callingHandlers.hasOwnProperty(key)) {
            const handler = this._callingHandlers[key];
            if (handler.once) {
                delete this._callingHandlers[key];
            }
            return [handler.callback];
        }

        for (let p of this._patterns) {
            const matches = method.match(p.pattern);
            if (matches) {
                return [p.callback, matches];
            }
        }
        return [undefined];
    }

    public async receive(request: any): Promise<void> {
        if (typeof request === 'string') {
            try {
                request = JSON.parse(request);
            } catch (e) {
                this._sendError(new RPCError('Parse error', -32700));
                return;
            }
        }

        if (request.jsonrpc !== '2.0') {
            this._sendError(new RPCError('Parse error', -32700));
            return;
        }

        if (Reflect.has(request, 'method')) {
            let method = request.method;
            let params = request.params;

            let remote;
            if (method.slice(-1) === '$') {
                // end with $, should return remote object
                method = method.slice(0, -1);
                remote = true;
            } else {
                remote = false;
            }

            let [f, matches]: any = this._getHandler(method);

            if (f === undefined && this._extendedRPCs.length > 0) {
                for (let rpc of this._extendedRPCs) {
                    [f, matches] = rpc._getHandler(method);
                    if (f) break;
                }
            }

            if (f === undefined) {
                if (request.id) {
                    this._sendError(new RPCError(`Method "${method}" not found`, -32601), request.id);
                }
                return;
            }

            params = this._decodeNonScalars(params);
            if (!Array.isArray(params)) {
                params = [params];
            }

            if (matches) {
                params = [params, matches];
            }

            const _sendError = (e: Error) => {
                if (e instanceof RPCError) {
                    this._sendError(e, request.id);
                } else {
                    throw e;
                }
            };

            try {
                return Promise.resolve(f(...params))
                    .then((result) => {
                        if (remote) {
                            // encode result and add ref
                            result = this._makeRemoteObject(result);
                        } else {
                            result = this._encodeNonScalars(result);
                        }
                        if (request.id) {
                            this._sendResult(result, request.id);
                        }
                    })
                    .catch(_sendError);
            } catch (e) {
                _sendError(e);
            }
        } else if (Reflect.has(request, 'error')) {
            if (request.id && this._promises.hasOwnProperty(request.id)) {
                let promise = this._promises[request.id];
                this._options.logger?.debug(`call ${promise.method} -> error ${request.error.code}`, {
                    method: promise.method,
                    params: promise.params,
                    error: request.error,
                });
                promise.reject(request.error);
                promise.timeout && clearRPCTimeout(promise.timeout);
                delete this._promises[request.id];
            }
        } else if (Reflect.has(request, 'result')) {
            if (request.id && this._promises.hasOwnProperty(request.id)) {
                let promise = this._promises[request.id];
                let result = request.result;
                this._options.logger?.debug(`call ${promise.method} -> success`, {
                    method: promise.method,
                    params: promise.params,
                    result: request.result,
                });
                if (result && typeof result === 'object' && Reflect.has(result, '@remote')) {
                    const self = this;
                    const remoteId = result['@remote'];
                    const RemoteObjectHandler: ProxyHandler<any> = {
                        set(target, prop, value) {
                            const sProp = String(prop);
                            const propName = target.$$baseName ? `${target.$$baseName}.${sProp}` : sProp;
                            self.call('_.RemoteObject.set', [remoteId, propName, value]);
                            return true;
                        },
                        get(target, prop) {
                            // 有可能被通过then来判断是否是个promise
                            const sProp = String(prop);
                            if (sProp === 'then' || sProp.substring(0, 2) === '$$') {
                                return undefined;
                            }
                            if (Reflect.has(target, prop)) {
                                return target[prop];
                            }
                            if (!Reflect.has(target.$$cache, prop)) {
                                target.$$cache[prop] = new Proxy(
                                    Object.assign(() => {}, {
                                        $$baseName: target.$$baseName ? `${target.$$baseName}.${sProp}` : sProp,
                                        $$cache: {},
                                    }),
                                    RemoteObjectHandler,
                                );
                            }
                            return target.$$cache[prop];
                        },
                        apply(target, _, params) {
                            return (
                                self._proxiedRemoteObjects[remoteId] &&
                                self.call('_.RemoteObject.apply', [remoteId, target.$$baseName, params])
                            );
                        },
                    };

                    self._proxiedRemoteObjects[remoteId] = true;
                    const $$cache = {} as any;
                    result = new Proxy(
                        Object.assign(() => {}, {
                            $$cache,
                            release$() {
                                Object.keys($$cache).forEach((prop) => delete $$cache[prop]);
                                return self.call('_.RemoteObject.release', [remoteId]).finally(() => {
                                    delete self._proxiedRemoteObjects[remoteId];
                                });
                            },
                            get$() {
                                return self.call('_.RemoteObject.get', [remoteId]);
                            },
                        }),
                        RemoteObjectHandler,
                    );
                } else {
                    result = this._decodeNonScalars(result);
                }
                promise.resolve(result);
                promise.timeout && clearRPCTimeout(promise.timeout);
                delete this._promises[request.id];
            }
        }
        // TODO: log the rest
        return Promise.resolve();
    }

    private async _sendResult(result: any, id?: string) {
        const data: RPCResultResponse = {
            jsonrpc: '2.0',
            result: result === undefined ? null : result,
        };
        if (id) data.id = id;
        return Promise.resolve(this._send(data)).catch(() => {});
    }

    private async _sendError(e: RPCError, id?: string) {
        const data: RPCErrorResponse = {
            jsonrpc: '2.0',
            error: {
                code: e.code,
                message: e.message,
            },
        };
        if (id) data.id = id;
        return Promise.resolve(this._send(data)).catch(() => {});
    }

    private async _sendRequest(method: string, params: any[], id?: string) {
        const data: RPCRequest = {
            jsonrpc: '2.0',
            method,
            params,
        };
        if (id) data.id = id;
        return Promise.resolve(this._send(data)).catch(() => {});
    }

    private _readyPromise:
        | {
              promise: Promise<void>;
              resolved: boolean;
              resolve?: () => void;
          }
        | false = false;
    private _readyCallbacks: (() => void)[] = [];

    setReady(ready = true) {
        this._options.ready = ready;
        if (ready) {
            if (this._readyPromise) {
                this._readyPromise.resolved = true;
                if (this._readyPromise.resolve) this._readyPromise.resolve();
            }
            this._readyCallbacks.forEach((it) => it());
        } else {
            if (this._readyPromise && this._readyPromise.resolved) {
                this._readyPromise = false;
            }
        }
    }

    setOptions(options: Partial<RPCOptions>) {
        this._options = { ...this._options, ...options };
    }

    whenReady(): Promise<void>;
    whenReady(callback: () => void): void;
    whenReady(callback?: () => void) {
        if (callback) {
            this._readyCallbacks.push(callback);
            return;
        }
        if (!this._readyPromise) {
            this._readyPromise = {
                promise: new Promise<void>((resolve) =>
                    setTimeout(() => {
                        if (!this._readyPromise) return;
                        this._readyPromise.resolve = resolve;
                        if (this._readyPromise.resolved) {
                            this._readyPromise.resolve();
                            resolve();
                        }
                    }),
                ),
                resolved: false,
            };
        }
        return this._readyPromise.promise;
    }

    notify(method: string, params: any = {}) {
        if (this._options.ready) {
            this._options.logger?.debug(`notify ${method}`, { method, params });
            this._sendRequest(method, this._encodeNonScalars(params));
        }
    }

    call(method: string, params: any = {}, timeout?: number) {
        if (!this._options.ready) {
            return Promise.reject(new RPCError('RPC is not ready yet', -32601));
        }
        return new Promise((resolve, reject) => {
            let id = nanoid(8);
            this._sendRequest(method, this._encodeNonScalars(params), id);

            timeout = timeout || this._options.timeout;

            let timeoutId: string;
            if (timeout !== -1) {
                timeoutId = setRPCTimeout(() => {
                    delete this._promises[id];
                    reject(new RPCError('Call timeout', -32603));
                }, timeout);
            }

            this._promises[id] = {
                method,
                params,
                resolve,
                reject,
                timeout: timeoutId,
            };
        });
    }

    once(method: string, callback: Function) {
        return this.on(method, callback, true);
    }

    on(method: string | RegExp, callback: Function, once = false) {
        if (typeof method !== 'string') {
            this._patterns.push({
                pattern: method,
                callback,
            });
        } else {
            this._callingHandlers[method.toLowerCase()] = { callback, once };
        }
        return this;
    }

    off(method: string | RegExp) {
        if (typeof method !== 'string') {
            for (let key in this._callingHandlers) {
                if (key.match(method) != null) delete this._callingHandlers[key];
            }

            let str = method.toString();
            this._patterns = this._patterns.filter((p) => p.pattern.toString() !== str);
        } else {
            delete this._callingHandlers[method.toLowerCase()];
        }
        return this;
    }
}

export { RPC };
export default RPC;
