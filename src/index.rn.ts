import { RPC } from './RPC';
import { Base64 } from 'js-base64';

Object.assign(RPC, {
    isBuffer: (value) => value instanceof ArrayBuffer || toString.call(value) === '[object ArrayBuffer]',
    bufferEncode: (value: ArrayBuffer) => Base64.btoa(String.fromCharCode(...new Uint8Array(value))),
    bufferDecode: (s: string) => {
        const value = Base64.atob(s);
        const arr = new Uint8Array(value.length);
        return arr.map((_, i) => value.charCodeAt(i)).buffer;
    },
});

export * from './RPC';
export * from './SmartRPC';
export default RPC;
