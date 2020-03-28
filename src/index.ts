import hash_sum from 'hash-sum';
import { nanoid } from 'nanoid/non-secure';

class RPCError extends Error {
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

class RPC {
    public send: Function;

    private _timeout = 5000;
    private _promises = new Map<string, RPCPromise>();
    private _callings = new Map<string, Function>();
    private _patterns: RPCPattern[] = [];

    private _hashedFunctions = new Map<string, Function>();
    private _remoteObjects = new Map<string, any>();
    private _remoteObjectClusters = new Map<string, string[]>();

    public static Error = RPCError;

    public constructor(send: Function, timeout = 5000) {
        this.send = send;
        this._timeout = timeout || 5000;

        this.on('_.Function.call', async (hash: string, params: any[]) => {
            if (this._hashedFunctions.has(hash)) {
                let f = this._hashedFunctions.get(hash);
                return await Promise.resolve(f(...params));
            }
        });

        this.on('_.Function.release', (hash: string) => {
            if (this._hashedFunctions.has(hash)) {
                this._hashedFunctions.delete(hash);
            }
        });

        this.on('_.RemoteObject.set', (remoteId: string, path: string, value: any) => {
            try {
                const obj = this._remoteObjects.get(remoteId);
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

        this.on('_.RemoteObject.get', async (remoteId: string) => {
            try {
                const obj = this._remoteObjects.get(remoteId);
                return JSON.parse(JSON.stringify(await Promise.resolve(obj)));
            } catch (e) {
                console.debug(e);
            }
        });

        this.on('_.RemoteObject.apply', async (remoteId: string, path: string, params: any) => {
            try {
                const obj = this._remoteObjects.get(remoteId);
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
                let ret = await Promise.resolve(Reflect.apply(o[lastProp], o, params));
                if (passToRemote) {
                    return JSON.parse(JSON.stringify(ret));
                }
                return this.makeRemoteObject(ret, remoteId);
            } catch {}
        });

        this.on('_.RemoteObject.release', (remoteId: string) => {
            const cluster = this._remoteObjectClusters.get(remoteId) || [];
            cluster.map(key => this._remoteObjects.delete(key));
            this._remoteObjectClusters.delete(remoteId);
            return true;
        });
    }

    private decodeFunctions(params: any) {
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
                        if (param.hasOwnProperty(k)) {
                            param[k] = _decode(param[k]);
                        }
                    }
                }
            } else if (Array.isArray(param)) {
                return param.map(p => _decode(p));
            }
            return param;
        };

        return _decode(params);
    }

    private encodeFunctions(params: any) {
        const _encode = (param: any): any => {
            if (typeof param === 'function') {
                let hash = hash_sum(param);
                this._hashedFunctions.set(hash, param);
                return { '@func': '1.0', hash };
            } else if (param === Object(param)) {
                for (let k in param) {
                    if (param.hasOwnProperty(k)) {
                        param[k] = _encode(param[k]);
                    }
                }
            } else if (Array.isArray(param)) {
                return param.map(p => _encode(p));
            }
            return param;
        };

        return _encode(params);
    }

    private makeRemoteObject(obj: any, remoteId?: string) {
        const uniqid = nanoid();
        this._remoteObjects.set(uniqid, obj);

        const rootId = remoteId || uniqid;
        const cluster: string[] = this._remoteObjectClusters.get(rootId) || [];
        cluster.push(uniqid);
        this._remoteObjectClusters.set(rootId, cluster);

        return { '@remote': uniqid };
    }

    private extendedRPCs: RPC[] = [];
    public extends(rpc: RPC) {
        this.extendedRPCs.push(rpc);
    }

    public getHandler(method: string) {
        let f, matches;
        if (this._callings.has(method)) {
            f = this._callings.get(method);
        } else {
            for (let { pattern, callback } of this._patterns) {
                matches = method.match(pattern);
                if (matches) {
                    f = callback;
                    break;
                }
            }
        }
        return [f, matches];
    }

    public async receive(request: any) {
        if (request.jsonrpc !== '2.0') {
            return false;
        }

        if (Reflect.has(request, 'method')) {
            let { method, params } = request;

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

            params = this.decodeFunctions(params);
            if (!Array.isArray(params)) {
                params = [params];
            }

            try {
                let result;
                if (matches) {
                    params = [params, matches];
                }

                result = await Promise.resolve(f(...params));
                if (remote) {
                    // encode result and add ref
                    result = this.makeRemoteObject(result);
                }
                if (request.id) return this.sendResult(result, request.id);
            } catch (e) {
                if (e instanceof RPCError) {
                    return this.sendError(e);
                } else {
                    throw e;
                }
            }
        } else if (Reflect.has(request, 'error')) {
            if (request.id && this._promises.has(request.id)) {
                let promise = this._promises.get(request.id);
                promise.reject(request.error);
                clearTimeout(promise.timeout);
                this._promises.delete(request.id);
            }
        } else if (Reflect.has(request, 'result')) {
            if (request.id && this._promises.has(request.id)) {
                let promise = this._promises.get(request.id);
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
                                Object.keys($$cache).forEach(prop => delete $$cache[prop]);
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
                this._promises.delete(request.id);
            }
        }
        // TODO: log the rest
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
        params = this.encodeFunctions(params);
        this.send({
            jsonrpc: '2.0',
            method,
            params,
        });
    }

    public call(method: string, params: any = {}) {
        params = this.encodeFunctions(params);
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

            self._promises.set(id, {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    self._promises.delete(id);
                    reject(new RPCError(`Call ${method} Timeout`, -32603));
                }, self._timeout),
            });
        });
    }

    public on(method: string | RegExp, cb: Function) {
        if (typeof method !== 'string') {
            this._patterns.push({
                pattern: method,
                callback: cb,
            });
        } else {
            this._callings.set(method, cb);
        }
        return this;
    }

    public off(method: string | RegExp) {
        if (typeof method !== 'string') {
            for (let key in this._callings.keys()) {
                if (key.match(method) != null) this._callings.delete(key);
            }

            let str = method.toString();
            this._patterns = this._patterns.filter(({ pattern }) => pattern.toString() !== str);
        } else {
            if (this._callings.has(method)) {
                this._callings.delete(method);
            }
        }
        return this;
    }
}

export default RPC;
