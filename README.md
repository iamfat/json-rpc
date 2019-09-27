# json-rpc

## Installation
```bash
yarn add git+https://github.com/iamfat/json-rpc.git
```

## Usage
```javascript
import JsonRPC from 'json-rpc'

const rpc = new JsonRPC(data => {
    // send your data with your customized function
})

rpc.receive(data) // process the data you received

rpc.on('xxx', () => {})
await rpc.call('xxx', params)
await rpc.notify('xxx', params)
```