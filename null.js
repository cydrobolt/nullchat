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

// TODO use redis to store keys & sockets
let users = {}
let rooms = {}

/* middleware */
app.use('/static', express.static('public'))
app.use('/directives', express.static('directives'))

/* routes */
app.get('/', (req, res) => {
    res.render('index.html')
})

app.get('/new_chat/', (req, res) => {
    var chatKey = crypto.randomBytes(16).toString('hex');
    res.redirect('/chat/' + chatKey)
})

app.get('/chat/:roomId', (req, res) => {
    var roomId = req.params.roomId
    rooms[roomId] = []

    res.render('null.html', { roomId: roomId })
})


/* socket */
io.on('connection', (sk) => {
    let generatedNick = getNick()

    let currentUser = {
        id: sk.id,
        nick: generatedNick,
        pubKey: null
    }

    // emit nick to client
    sk.emit('welcome', currentUser.nick)

    sk.on('pubkey', (data) => {
        // save user's public key
        currentUser.pubkey = data
    })

    sk.on('joinRoom', (roomId) => {
        if (rooms[roomId].length >= 2) {
            // room is full; two users maximum
            sk.disconnect()
        }
        // save user to current users
        users[sk.id] = currentUser
        // add user to roomId
        rooms[roomId].push(sk.id)
    })

    sk.on('disconnect', () => {
        delete users[sk.id]
    })


})

export { server }
