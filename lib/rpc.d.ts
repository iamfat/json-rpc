export declare class RPCError extends Error {
    message: string;
    code: number;
    constructor(message: string, code: number);
    toString(): string;
}
export declare type RPCSend = (data: any) => void;
export declare type RPCOptions = {
    timeout?: number;
};
export declare class RPC {
    send: RPCSend;
    static Error: typeof RPCError;
    static isBuffer: Function;
    static bufferEncode: Function;
    static bufferDecode: Function;
    private _options;
    private _promises;
    private _callingHandlers;
    private _patterns;
    private _hashedFunctions;
    private _remoteObjects;
    private _remoteObjectClusters;
    constructor(send: RPCSend, options?: RPCOptions);
    private decodeNonScalars;
    private encodeNonScalars;
    private makeRemoteObject;
    private extendedRPCs;
    extends(rpc: RPC): void;
    private getHandler;
    receive(request: any): Promise<void>;
    sendResult(result: any, id?: string): this;
    sendError(e: RPCError, id?: string): this;
    notify(method: string, params?: any): void;
    call(method: string, params?: any): Promise<unknown>;
    once(method: string, callback: Function): this;
    on(method: string | RegExp, callback: Function, once?: boolean): this;
    off(method: string | RegExp): this;
}
