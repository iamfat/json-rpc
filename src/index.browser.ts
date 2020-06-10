export * from './rpc';
import { RPC } from './rpc';

Object.assign(RPC, {
    isBuffer: (value) => value instanceof ArrayBuffer || toString.call(value) === '[object ArrayBuffer]',
    bufferEncode: (value: ArrayBuffer) => window.btoa(String.fromCharCode(...new Uint8Array(value))),
    bufferDecode: (s: string) => {
        const value = window.atob(s);
        const arr = new Uint8Array(value.length);
        return arr.map((_, i) => value.charCodeAt(i)).buffer;
    },
});

export default RPC;
