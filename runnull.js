import { server } from './null'
import config from './config.json'

let port = config.port || 5000

server.listen(port, () => {
    console.log('running null')
})
