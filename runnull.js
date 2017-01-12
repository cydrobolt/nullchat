import { server } from './null'

let port = process.env.PORT || 5000
let host = process.env.HOST || '127.0.0.1'

server.listen(port, host, () => {
    console.log('running null')
})
