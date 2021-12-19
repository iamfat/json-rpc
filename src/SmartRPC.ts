import { RPC } from './RPC';

type SmartRPCNode = {
    [prop: string | symbol]: SmartRPCNode;
} & ((...args: any[]) => Promise<any>);

type SmartifyOptions = {
    exclude: (string | symbol)[];
};

function SmartifyInstance<T extends RPC>(rpc: T, options?: SmartifyOptions) {
    const rpcHandler = {
        get(target: any, prop: any) {
            if (target.$rpcMethod && prop === '$notify') {
                return (...params: any[]) => rpc.notify(target.$rpcMethod, params);
            } else if (String(prop).charAt(0) === '$') {
                return; // undefined
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
    });
}

interface SmartRPC<T = RPC> extends RPC {
    new (...args: any[]): SmartRPC<T>;
    [prop: string]: SmartRPCNode | any;
}

// new <T extends object>(target: T, handler: ProxyHandler<T>): T;
function Smartify<T extends object>(target: T, options?: SmartifyOptions) {
    return new Proxy(target, {
        construct(targetClass, args: any[]) {
            return SmartifyInstance(Reflect.construct(targetClass as Function, args), options);
        },
    }) as unknown as SmartRPC<T>;
}

export type { SmartRPCNode };
export { SmartRPC, Smartify, SmartifyInstance };
