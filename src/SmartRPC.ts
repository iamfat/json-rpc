import { RPC } from './RPC';

type SmartRPCNode = RPC & {
    [prop: string | symbol]: SmartRPCNode;
} & (<T = any>(...args: any[]) => Promise<T>);

interface SmartRPC<T = RPC> extends RPC {
    new (...args: any[]): SmartRPC<T>;
    [prop: string]: SmartRPCNode | any;
}

type SmartifyOptions = {
    exclude: (string | symbol)[];
};

function SmartifyInstance<T>(target: T, options?: SmartifyOptions) {
    const rpc = target as unknown as RPC;
    const rpcHandler = {
        get(target: any, prop: any) {
            if (typeof prop !== 'string') {
                return target[prop];
            }
            if (prop.charAt(0) === '$') {
                return target[prop.substring(1)];
            } else if (!Reflect.has(target.$cache, prop)) {
                target.$cache[prop] = new Proxy(
                    Object.assign(() => {}, {
                        $rpcMethod:
                            target.$rpcMethod.length > 0 ? `${target.$rpcMethod}.${String(prop)}` : String(prop),
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
    const { exclude = ['then', 'catch', 'finally'] } = { ...options };
    return new Proxy(rpc, {
        get(target: any, prop: string | symbol) {
            if (Reflect.has(target, prop) || exclude.includes(prop)) {
                return target[prop];
            }
            if (!Reflect.has($cache, prop)) {
                $cache[prop] = new Proxy(
                    Object.assign(() => {}, {
                        $rpcMethod: String(prop),
                        $cache: {},
                    }),
                    rpcHandler,
                );
            }
            return $cache[prop];
        },
    }) as SmartRPCNode;
}

// new <T extends object>(target: T, handler: ProxyHandler<T>): T;
function Smartify<T extends object>(target: T, options?: SmartifyOptions) {
    return new Proxy(target, {
        construct(targetClass, args: any[]) {
            return SmartifyInstance<T>(Reflect.construct(targetClass as unknown as Function, args), options);
        },
    }) as unknown as SmartRPC<T>;
}

export type { SmartRPCNode };
export { SmartRPC, Smartify, SmartifyInstance };
