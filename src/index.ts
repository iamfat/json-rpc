import nanoid from 'nanoid/non-secure'
import hash_sum from 'hash-sum'

class RPCError extends Error {
    public code: number
    public message: string

    public constructor(message: string, code: number) {
        super()
        this.code = code || 0
        this.message = message
    }

    public toString() {
        return this.message
    }
}

interface RPCRequest {
    jsonrpc: string
    id?: string
    method: string
    params: any
}

interface RPCResponse {
    jsonrpc: string
    id?: string
    result?: any
    error?: any
}

interface RPCPattern {
    pattern: RegExp
    callback: Function
}

interface RPCPromise {
    resolve: Function
    reject: Function
    timeout: any
}

const HASHED_FUNCTIONS = new Map<string, Function>()
const REMOTE_OBJECTS = new Map<string, any>()
const REMOTE_OBJECT_CLUSTERS = new Map<string, string[]>()

class RPC {

    public send: Function

    private _timeout = 5000
    private _promises = new Map<string, RPCPromise>()
    private _callings = new Map<string, Function>()
    private _patterns: RPCPattern[] = []

    public static Error = RPCError

    public constructor(send: Function, timeout = 5000) {
        this.send = send
        this._timeout = timeout || 5000

        this.on('_.Function.call', async (hash: string, params: any[]) => {
            if (HASHED_FUNCTIONS.has(hash)) {
                let f = HASHED_FUNCTIONS.get(hash)
                return await f(...params) || null
            }
        })

        this.on('_.RemoteObject.get', async (remoteId: string, path: string) => {
            try {
                const obj = REMOTE_OBJECTS.get(remoteId)
                let o = obj
                for (let p in path.split('.')) {
                    o = o[p]
                }
                return await o
            } catch { }
        })

        this.on('_.RemoteObject.set', (remoteId: string, path: string, value: any) => {
            try {
                const obj = REMOTE_OBJECTS.get(remoteId)
                const props = path.split('.')
                const lastProp = props.pop()
                let o = obj
                for (let p in props) {
                    o = o[p]
                }
                o[lastProp] = value
            } catch { }
        })

        this.on('_.RemoteObject.apply', async (remoteId: string, path: string, params: any) => {
            try {
                const obj = REMOTE_OBJECTS.get(remoteId)
                let f = obj
                for (let p in path.split('.')) {
                    f = f[p]
                }
                const o = await f(...params)
                return this.makeRemoteObject(o, remoteId)
            } catch { }
        })

        this.on('_.RemoteObject.release', (remoteId: string) => {
            const cluster = REMOTE_OBJECT_CLUSTERS.get(remoteId) || []
            cluster.map(key => REMOTE_OBJECTS.delete(key))
            REMOTE_OBJECT_CLUSTERS.delete(remoteId)
            return true
        })

    }

    private decodeFunctions(params: any) {
        const self = this

        const _decode = (param: any): any => {
            if (param === Object(param)) {
                if (param['@func'] === '1.0' && Reflect.has(param, 'has')) {
                    return new Proxy(() => { }, {
                        apply(_, __, params) {
                            self.notify('_.Function.call', [param.hash, params])
                        }
                    })
                } else {
                    for (let k in param) {
                        if (param.hasOwnProperty(k)) {
                            param[k] = _decode(param[k])
                        }
                    }
                }
            } else if (Array.isArray(param)) {
                return param.map(p => _decode(p))
            }
            return param
        }

        return _decode(params)
    }

    private encodeFunctions(params: any) {

        const _encode = (param: any): any => {
            if (typeof (param) === 'function') {
                let hash = hash_sum(param)
                HASHED_FUNCTIONS.set(hash, param)
                return { '@func': '1.0', hash }
            } else if (param === Object(param)) {
                for (let k in param) {
                    if (param.hasOwnProperty(k)) {
                        param[k] = _encode(param[k])
                    }
                }
            } else if (Array.isArray(param)) {
                return param.map(p => _encode(p))
            }
            return param
        }

        return _encode(params)
    }

    private makeRemoteObject(obj: any, remoteId?: string) {
        const uniqid = nanoid()
        REMOTE_OBJECTS.set(uniqid, obj)

        const rootId = remoteId || uniqid
        const cluster: string[] = REMOTE_OBJECT_CLUSTERS.get(rootId) || []
        cluster.push(uniqid)
        REMOTE_OBJECT_CLUSTERS.set(rootId, cluster)

        return { '@remote': uniqid }
    }

    private extendedRPCs: RPC[] = []
    public extends(rpc: RPC) {
        this.extendedRPCs.push(rpc)
    }

    public getHandler(method: string) {
        let f, matches
        if (this._callings.has(method)) {
            f = this._callings.get(method)
        } else {
            for (let { pattern, callback } of this._patterns) {
                matches = method.match(pattern)
                if (matches) {
                    f = callback
                    break
                }
            }
        }
        return [f, matches]
    }

    public async receive(request: any) {
        if (request.jsonrpc !== '2.0') {
            return false
        }

        if (Reflect.has(request, 'method')) {
            let { method, params } = request

            let remote
            if (method.slice(-1) === '$') {
                // end with $, should return remote object
                method = method.slice(0, -1)
                remote = true
            } else {
                remote = false
            }

            let [f, matches]: any = this.getHandler(method)

            if (f === undefined && this.extendedRPCs.length > 0) {
                for (let rpc of this.extendedRPCs) {
                    [f, matches] = rpc.getHandler(method)
                    if (f) break
                }
            }

            if (f === undefined) {
                return this.sendError(
                    new RPCError(`Method "${method}" not found`, -32601),
                    request.id
                )
            }

            params = this.decodeFunctions(params)
            if (!Array.isArray(params)) {
                params = [params]
            }

            try {
                let result
                if (matches) {
                    result = await f(params, matches) || null
                } else {
                    result = await f(...params) || null
                }
                if (remote) {
                    // encode result and add ref
                    result = this.makeRemoteObject(result)
                }
                if (request.id) return this.sendResult(result, request.id)
            } catch (e) {
                if (e instanceof RPCError) {
                    return this.sendError(e)
                } else {
                    throw e
                }
            }
        } else if (Reflect.has(request, 'error')) {
            if (request.id && this._promises.has(request.id)) {
                let promise = this._promises.get(request.id)
                promise.reject(request.error)
                clearTimeout(promise.timeout)
                this._promises.delete(request.id)
            }
        } else if (Reflect.has(request, 'result')) {
            if (request.id && this._promises.has(request.id)) {
                let promise = this._promises.get(request.id)
                let result = request.result
                if (result && typeof result === 'object' && result['@remote']) {
                    const self = this
                    const remoteId = result['@remote']
                    const RemoteObjectHandler: ProxyHandler<any> = {
                        set(target, prop, value) {
                            self.call('_.RemoteObject.set',
                                [remoteId, `${target.$$baseName}/${String(prop)}`, value])
                            return true
                        },
                        get(target, prop) {
                            if (String(prop).slice(0, 1) == '$$') {
                                return
                            }
                            if (Reflect.has(target, prop)) {
                                return target[prop]
                            }
                            if (!Reflect.has(target.$$cache, prop)) {
                                target.$$cache[prop] = new Proxy(
                                    Object.assign(() => { }, {
                                        $$baseName: `${target.$$baseName}.${String(prop)}`,
                                        $$cache: {},
                                        get $() {
                                            return self.call('_.RemoteObject.get', [remoteId, target.$$baseName])
                                        }
                                    }),
                                    RemoteObjectHandler
                                )
                            }
                            return target.$$cache[prop]
                        },
                        apply(target, _, params) {
                            return self.call('_.RemoteObject.apply', [remoteId, target.$$baseName, params])
                        }
                    }
                    result = new Proxy({
                        $$baseName: '',
                        $$cache: {} as any,
                        release$() {
                            return self.call('_.RemoteObject.release', [remoteId])
                        }
                    }, RemoteObjectHandler)
                }
                promise.resolve(result)
                clearTimeout(promise.timeout)
                this._promises.delete(request.id)
            }
        }
        // TODO: log the rest
    }

    public sendResult(result: any, id?: string) {
        const data: any = {
            jsonrpc: '2.0',
            result
        }
        if (id) data.id = id
        this.send(data)
        return this
    }

    public sendError(e: RPCError, id?: string) {
        const data: any = {
            jsonrpc: '2.0',
            error: {
                code: e.code,
                message: e.message
            }
        }
        if (id) data.id = id
        this.send(data)
        return this
    }

    public notify(method: string, params: any = {}) {
        params = this.encodeFunctions(params)
        this.send({
            jsonrpc: '2.0',
            method,
            params
        })
    }

    public call(method: string, params: any = {}) {
        params = this.encodeFunctions(params)
        let self = this
        return new Promise((resolve, reject) => {
            let id = nanoid()
            let data = {
                id,
                jsonrpc: '2.0',
                method,
                params
            }

            self.send(data)

            self._promises.set(id, {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    self._promises.delete(id)
                    reject(new RPCError(`Call ${method} Timeout`, -32603))
                }, self._timeout)
            })
        })
    }

    public on(method: string | RegExp, cb: Function) {
        if (typeof (method) !== 'string') {
            this._patterns.push({
                pattern: method,
                callback: cb
            })
        } else {
            this._callings.set(method, cb)
        }
        return this
    }

    public off(method: string | RegExp) {
        if (typeof (method) !== 'string') {
            for (let key in this._callings.keys()) {
                if (key.match(method) != null) this._callings.delete(key)
            }

            let str = method.toString()
            this._patterns = this._patterns.filter(
                ({ pattern }) => pattern.toString() !== str
            )
        } else {
            if (this._callings.has(method)) {
                this._callings.delete(method)
            }
        }
        return this
    }
}

export default RPC
