import { RPC } from './RPC';

Object.assign(RPC, {
    isBuffer: (value) => Buffer.isBuffer(value),
    bufferEncode: (value: Buffer) => value.toString('base64'),
    bufferDecode: (s: string) => Buffer.from(s, 'base64'),
});

export * from './RPC';
export * from './SmartRPC';
export default RPC;

