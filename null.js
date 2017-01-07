import express from 'express'
import http from 'http'
import bodyParser from 'body-parser'
import config from './config.json'
import SocketIO from 'socket.io'
import crypto from 'crypto'
import nunjucks from 'nunjucks'

import { getNick } from './lib/nicknames'

/* initialization */
let app = express()
nunjucks.configure('views', {
    autoescape: true,
    express: app
})

let server = http.Server(app)
let io = SocketIO(server)

/* middleware */
app.use('/static', express.static('public'))

let users = []
let sockets = {}

/* routes */
app.get('/', (req, res) => {
    res.render('index.html')
})


/* socket */
io.on('connection', (sk) => {
    let dhSecret = sk.handshake.query.dh_secret
    let generatedNick = getNick()

    let currentUser = {
        id: sk.id,
        nick: generatedNick
    }

})

export { server }
