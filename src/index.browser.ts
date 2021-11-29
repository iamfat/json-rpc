import { RPC } from './RPC';

Object.assign(RPC, {
    isBuffer: (value) => value instanceof ArrayBuffer || toString.call(value) === '[object ArrayBuffer]',
    bufferEncode: (value: ArrayBuffer) => window.btoa(String.fromCharCode(...new Uint8Array(value))),
    bufferDecode: (s: string) => {
        const value = window.atob(s);
        const arr = new Uint8Array(value.length);
        return arr.map((_, i) => value.charCodeAt(i)).buffer;
    },
});

export type { RPCSend, RPCOptions } from './RPC';
export { RPCError } from './RPC';
export * from './SmartRPC';
export { RPC };
export default RPC;
