const hash_sum = require('hash-sum');
const { nanoid } = require('nanoid/non-secure');

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

interface RPCRequest {
    jsonrpc: string;
    id?: string;
    method: string;
    params: any;
}

interface RPCResponse {
    jsonrpc: string;
    id?: string;
    result?: any;
    error?: any;
}

interface RPCPattern {
    pattern: RegExp;
    callback: Function;
}

interface RPCPromise {
    resolve: Function;
    reject: Function;
    timeout: any;
}

export type RPCSend = (data: any) => void;
export type RPCOptions = { timeout?: number };

export class RPC {
    public send: RPCSend;
    public static Error = RPCError;
    public static isBuffer: Function;
    public static bufferEncode: Function;
    public static bufferDecode: Function;

    private _options: RPCOptions;
    private _promises: { [method: string]: RPCPromise } = {};
    private _callingHandlers: { [method: string]: { callback: Function; once: boolean } } = {};
    private _patterns: RPCPattern[] = [];

    private _hashedFunctions: { [hash: string]: Function } = {};
    private _remoteObjects: { [id: string]: any } = {};
    private _remoteObjectClusters: { [id: string]: string[] } = {};

    public constructor(send: RPCSend, options?: RPCOptions) {
        this.send = send;
        this._options = { timeout: 5000, ...(options || {}) };

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
                console.debug(e);
            }
        });

        this.on('_.RemoteObject.get', (remoteId: string) => {
            const obj = this._remoteObjects[remoteId];
            return Promise.resolve(obj)
                .then((o) => {
                    return JSON.parse(JSON.stringify(o));
                })
                .catch((e) => {
                    console.debug('_.RemoteObject.get error', e);
                });
        });

        this.on('_.RemoteObject.apply', (remoteId: string, path: string, params: any) => {
            const obj = this._remoteObjects[remoteId];
            let passToRemote, props;
            if (path.slice(-1) === '$') {
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
                return this.makeRemoteObject(ret, remoteId);
            });
        });

        this.on('_.RemoteObject.release', (remoteId: string) => {
            const cluster = this._remoteObjectClusters[remoteId] || [];
            cluster.map((key) => delete this._remoteObjects[key]);
            delete this._remoteObjectClusters[remoteId];
            return true;
        });
    }

    private decodeNonScalars(params: any) {
        const self = this;

        const _decode = (param: any): any => {
            if (param === Object(param)) {
                if (param['@func'] === '1.0' && Reflect.has(param, 'hash')) {
                    return new Proxy(() => {}, {
                        get(target, prop) {
                            // 有可能被通过then来判断是否是个promise
                            const sProp = String(prop);
                            if (Reflect.has(target, prop)) {
                                return target[prop];
                            }
                            if (sProp === 'release') {
                                return () => {
                                    self.notify('_.Function.release', [param.hash]);
                                };
                            }
                        },
                        apply(_, __, params) {
                            self.notify('_.Function.call', [param.hash, params]);
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

    private encodeNonScalars(params: any) {
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

    private makeRemoteObject(obj: any, remoteId?: string) {
        const uniqid = nanoid();
        this._remoteObjects[uniqid] = obj;

        const rootId = remoteId || uniqid;
        const cluster = this._remoteObjectClusters[rootId] || [];
        cluster.push(uniqid);
        this._remoteObjectClusters[rootId] = cluster;

        return { '@remote': uniqid };
    }

    private extendedRPCs: RPC[] = [];
    public extends(rpc: RPC) {
        this.extendedRPCs.push(rpc);
    }

    private getHandler(method: string): [Function, RegExpMatchArray?] {
        if (this._callingHandlers.hasOwnProperty(method)) {
            const handler = this._callingHandlers[method];
            if (handler.once) {
                delete this._callingHandlers[method];
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

    public receive(request: any): Promise<void> {
        if (typeof request === 'string') {
            try {
                request = JSON.parse(request);
            } catch (e) {
                this.sendError(new RPCError('Parse error', -32700));
                return;
            }
        }

        if (request.jsonrpc !== '2.0') {
            this.sendError(new RPCError('Parse error', -32700));
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

            let [f, matches]: any = this.getHandler(method);

            if (f === undefined && this.extendedRPCs.length > 0) {
                for (let rpc of this.extendedRPCs) {
                    [f, matches] = rpc.getHandler(method);
                    if (f) break;
                }
            }

            if (f === undefined) {
                if (request.id) {
                    this.sendError(new RPCError(`Method "${method}" not found`, -32601), request.id);
                }
                return;
            }

            params = this.decodeNonScalars(params);
            if (!Array.isArray(params)) {
                params = [params];
            }

            if (matches) {
                params = [params, matches];
            }
            return Promise.resolve(f(...params))
                .then((result) => {
                    if (remote) {
                        // encode result and add ref
                        result = this.makeRemoteObject(result);
                    }
                    if (request.id) {
                        this.sendResult(result, request.id);
                    }
                })
                .catch((e) => {
                    if (e instanceof RPCError) {
                        this.sendError(e, request.id);
                    } else {
                        throw e;
                    }
                });
        } else if (Reflect.has(request, 'error')) {
            if (request.id && this._promises.hasOwnProperty(request.id)) {
                let promise = this._promises[request.id];
                promise.reject(request.error);
                clearTimeout(promise.timeout);
                delete this._promises[request.id];
            }
        } else if (Reflect.has(request, 'result')) {
            if (request.id && this._promises.hasOwnProperty(request.id)) {
                let promise = this._promises[request.id];
                let result = request.result;
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
                            if (sProp === 'then' || sProp.slice(0, 1) === '$$') {
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
                            return self.call('_.RemoteObject.apply', [remoteId, target.$$baseName, params]);
                        },
                    };

                    const $$cache = {} as any;
                    result = new Proxy(
                        Object.assign(() => {}, {
                            $$cache,
                            release$() {
                                Object.keys($$cache).forEach((prop) => delete $$cache[prop]);
                                return self.call('_.RemoteObject.release', [remoteId]);
                            },
                            get$() {
                                return self.call('_.RemoteObject.get', [remoteId]);
                            },
                        }),
                        RemoteObjectHandler,
                    );
                }
                promise.resolve(result);
                clearTimeout(promise.timeout);
                delete this._promises[request.id];
            }
        }
        // TODO: log the rest
        return Promise.resolve();
    }

    public sendResult(result: any, id?: string) {
        const data: any = {
            jsonrpc: '2.0',
            result: result || null,
        };
        if (id) data.id = id;
        this.send(data);
        return this;
    }

    public sendError(e: RPCError, id?: string) {
        const data: any = {
            jsonrpc: '2.0',
            error: {
                code: e.code,
                message: e.message,
            },
        };
        if (id) data.id = id;
        this.send(data);
        return this;
    }

    public notify(method: string, params: any = {}) {
        params = this.encodeNonScalars(params);
        this.send({
            jsonrpc: '2.0',
            method,
            params,
        });
    }

    public call(method: string, params: any = {}) {
        params = this.encodeNonScalars(params);
        let self = this;
        return new Promise((resolve, reject) => {
            let id = nanoid();
            let data = {
                id,
                jsonrpc: '2.0',
                method,
                params,
            };

            self.send(data);

            self._promises[id] = {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    delete self._promises[id];
                    reject(new RPCError(`Call ${method} Timeout`, -32603));
                }, self._options.timeout),
            };
        });
    }

    public once(method: string, callback: Function) {
        return this.on(method, callback, true);
    }

    public on(method: string | RegExp, callback: Function, once = false) {
        if (typeof method !== 'string') {
            this._patterns.push({
                pattern: method,
                callback,
            });
        } else {
            this._callingHandlers[method] = { callback, once };
        }
        return this;
    }

    public off(method: string | RegExp) {
        if (typeof method !== 'string') {
            for (let key in this._callingHandlers) {
                if (key.match(method) != null) delete this._callingHandlers[key];
            }

            let str = method.toString();
            this._patterns = this._patterns.filter((p) => p.pattern.toString() !== str);
        } else {
            delete this._callingHandlers[method];
        }
        return this;
    }
}
