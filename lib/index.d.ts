declare class RPCError extends Error {
    code: number;
    message: string;
    constructor(message: string, code: number);
    toString(): string;
}
declare class RPC {
    send: Function;
    private _timeout;
    private _promises;
    private _callings;
    private _patterns;
    private _hashedFunctions;
    private _remoteObjects;
    private _remoteObjectClusters;
    static Error: typeof RPCError;
    constructor(send: Function, timeout?: number);
    private decodeFunctions;
    private encodeFunctions;
    private makeRemoteObject;
    private extendedRPCs;
    extends(rpc: RPC): void;
    getHandler(method: string): (Function | RegExpMatchArray)[];
    receive(request: any): Promise<false | this>;
    sendResult(result: any, id?: string): this;
    sendError(e: RPCError, id?: string): this;
    notify(method: string, params?: any): void;
    call(method: string, params?: any): Promise<unknown>;
    on(method: string | RegExp, cb: Function): this;
    off(method: string | RegExp): this;
}
export default RPC;
