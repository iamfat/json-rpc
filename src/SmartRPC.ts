import { RPC } from './RPC';

type SmartRPCNode = {
    [prop: string | symbol]: SmartRPCNode;
} & ((...args: any[]) => Promise<any>);

class SmartRPCRoot extends RPC {
    [prop: string | symbol]: SmartRPCNode | any;
    constructor(..._: any[]) {
        super(() => { });
    }
}

// new <T extends object>(target: T, handler: ProxyHandler<T>): T;
function Smartify<T extends object>(RPCClass: T) {
    return new Proxy(SmartRPCRoot, {
        construct(_, args: any[]) {
            const rpc = new (RPCClass as any)(...args);
            const rpcHandler = {
                get(target: any, prop: any) {
                    if (target.$rpcMethod && prop === '$notify') {
                        return (...params: any[]) => rpc.notify(target.$rpcMethod, params);
                    } else if (String(prop).charAt(0) === '$') {
                        return; // undefined
                    } else if (!Reflect.has(target.$cache, prop)) {
                        target.$cache[prop] = new Proxy(
                            Object.assign(() => { }, {
                                $rpcMethod: target.$rpcMethod.length > 0 ? `${target.$rpcMethod}.${String(prop)}` : String(prop),
                                $cache: {},
                            }),
                            rpcHandler,
                        );
                    }
                    return target.$cache[prop] as SmartRPCNode;
                },
                apply(target: any, _: any, params: any) {
                    if (Reflect.has(rpc, target.$rpcMethod) && (rpc as any)[target.$rpcMethod] instanceof Function) {
                        return (rpc as any)[target.$rpcMethod](...params);
                    }
                    return rpc.call(target.$rpcMethod, params);
                },
            };

            const $cache: any = {};
            return new Proxy(rpc, {
                get(target: any, prop: any) {
                    if (Reflect.has(target, prop)) {
                        return target[prop];
                    }
                    if (!Reflect.has($cache, prop)) {
                        $cache[prop] = new Proxy(
                            Object.assign(() => { }, {
                                $rpcMethod: String(prop),
                                $cache: {},
                            }),
                            rpcHandler,
                        );
                    }
                    return $cache[prop];
                }
            });
        }
    });
}

export type { SmartRPCNode };
export { SmartRPCRoot, Smartify };
