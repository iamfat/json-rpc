# json-rpc

## Installation
```bash
yarn add git+https://github.com/iamfat/json-rpc.git
```

## Usage
### General
```typescript
import JsonRPC from '@genee/json-rpc'

const rpc = new JsonRPC(data => {
    // send your data with your customized function
}, {
    // logger?: console // you may customize your own logger 
})

rpc.receive(data) // process the data you received

rpc.on('xxx', () => {})
await rpc.call('xxx', params)
await rpc.notify('xxx', params)

rpc.setReady(false); 
rpc.setReady(true);

// get referenced functions and objects
const { functions, objects } = rpc.stat();
```

### SmartRPC
```typescript
import JsonRPC, { Smartify } from '@genee/json-rpc';

const SmartRPC = Smaritfy(JsonRPC);
const rpc = new SmartRPC(data => {
    // do your sending
})

rpc.setReady(false);
rpc.call('hello').catch(e => {
    // throw -32601 immediately.
    // e.code == -32601, not ready yet
});

rpc.setReady(true);

rpc.whenReady(() => {
    // DO SOMEHTING WHEN RPC READY
});

rpc.whenNotReady(() => {
    // DO SOMEHTING WHEN RPC NOT READY
})

rpc.receive(data); // process data you received

await rpc.Namespace1.Namespace2.Method1('hello'); // == rpc.call('Namespace1.Namespace2.Method1', ['hello'])

```