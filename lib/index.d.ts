declare class RPCError extends Error {
    message: string;
    code: number;
    constructor(message: string, code: number);
    toString(): string;
}
declare type RPCSend = (data: any) => void;
declare class RPC {
    send: RPCSend;
    private _timeout;
    private _promises;
    private _callings;
    private _patterns;
    private _hashedFunctions;
    private _remoteObjects;
    private _remoteObjectClusters;
    static Error: typeof RPCError;
    constructor(send: RPCSend, timeout?: number);
    private decodeFunctions;
    private encodeFunctions;
    private makeRemoteObject;
    private extendedRPCs;
    extends(rpc: RPC): void;
    getHandler(method: string): any[];
    receive(request: any): Promise<void>;
    sendResult(result: any, id?: string): this;
    sendError(e: RPCError, id?: string): this;
    notify(method: string, params?: any): void;
    call(method: string, params?: any): Promise<unknown>;
    on(method: string | RegExp, cb: Function): this;
    off(method: string | RegExp): this;
}
export default RPC;
