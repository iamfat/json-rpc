describe('JSON-RPC', () => {
    const JsonRPC = require('../lib/index').default;

    it('should transfer request', (done) => {
        const rpc = new JsonRPC((request) => {
            expect(request.jsonrpc).toBe('2.0');
            expect(request.method).toBe('hello');
            expect(request.params).toEqual(['world']);
            done();
        });
        rpc.call('hello', ['world']);
    });

    it('should support timeout', (done) => {
        const rpc = new JsonRPC((request) => {
            // DO NOTHING BUT IDLE
        });

        const now = Date.now();
        rpc.call('hello', ['world'], 1000).catch((e) => {
            expect(e.code).toBe(-32603);
            expect(Date.now() - now > 1000);
            done();
        });
    });

    it('should be called', (done) => {
        const rpc = new JsonRPC(() => {});
        rpc.on('hello', (...args) => {
            expect(args).toEqual(['world']);
            done();
        });

        rpc.receive({
            id: 'foo',
            jsonrpc: '2.0',
            method: 'hello',
            params: ['world'],
        });
    });

    it('should be called ignore case', (done) => {
        const rpc = new JsonRPC(() => {});
        rpc.on('hello', (...args) => {
            expect(args).toEqual(['world']);
            done();
        });

        rpc.receive({
            id: 'foo',
            jsonrpc: '2.0',
            method: 'HelLo',
            params: ['world'],
        });
    });

    it('should be called when passing object', (done) => {
        const rpc = new JsonRPC(() => {});
        rpc.on('hello', (...args) => {
            expect(args).toEqual([{ foo: 'bar' }]);
            done();
        });

        rpc.receive({
            id: 'foo',
            jsonrpc: '2.0',
            method: 'hello',
            params: { foo: 'bar' },
        });
    });

    it('should communicate', (done) => {
        const rpcSender = new JsonRPC((request) => {
            rpcReceiver.receive(request);
        });
        const rpcReceiver = new JsonRPC((request) => {
            rpcSender.receive(request);
        });

        rpcReceiver.on('hello', (...args) => {
            expect(args).toEqual([{ world: 'beautiful' }]);
            done();
        });

        rpcSender.call('hello', { world: 'beautiful' });
    });

    it('should encode functions', (done) => {
        const rpcSender = new JsonRPC((request) => {
            rpcReceiver.receive(request);
        });
        const rpcReceiver = new JsonRPC((request) => {
            rpcSender.receive(request);
        });

        rpcReceiver.on('hello', ({ world }) => {
            world('back');
        });

        rpcSender.call('hello', {
            world: (message) => {
                expect(message).toBe('back');
                done();
            },
        });
    });

    it('should encode buffers', (done) => {
        const rpcSender = new JsonRPC((request) => {
            rpcReceiver.receive(request);
        });
        const rpcReceiver = new JsonRPC((request) => {
            rpcSender.receive(request);
        });

        const bytes = Buffer.from(require('crypto').randomBytes(16));
        rpcReceiver.on('hello', (o) => {
            expect(o.bytes).toEqual(bytes);
            done();
        });

        rpcSender.call('hello', {
            bytes,
        });
    });

    it('should encode buffers in result', (done) => {
        const rpcSender = new JsonRPC((request) => {
            rpcReceiver.receive(request);
        });
        const rpcReceiver = new JsonRPC((request) => {
            rpcSender.receive(request);
        });

        const bytes = Buffer.from(require('crypto').randomBytes(16));
        rpcReceiver.on('hello', async () => {
            return bytes;
        });

        rpcSender.call('hello').then((o) => {
            expect(o).toEqual(bytes);
            done();
        });
    });
});
