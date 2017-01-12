import express from 'express'
import http from 'http'
import bodyParser from 'body-parser'
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
    var chatKey = crypto.randomBytes(16).toString('hex')
    res.redirect('/chat/' + chatKey)
})

app.get('/chat/:roomId', (req, res) => {
    var roomId = req.params.roomId
    if (!(roomId in rooms)) {
        rooms[roomId] = []
    }

    res.render('null.html', { roomId: roomId })
})


/* socket */
io.on('connection', (sk) => {
    let generatedNick = getNick()

    let currentUser = {
        id: sk.id,
        nick: generatedNick,
        pubkey: null,
        room: null
    }

    // emit nick to client
    sk.emit('welcome', currentUser.nick)

    sk.on('pubkey', (data) => {
        // save user's public key
        currentUser.pubkey = data
    })

    sk.on('joinRoom', (roomId) => {
        if (!(roomId in rooms) || (rooms[roomId] === undefined)) {
            sk.emit('warn', 'Room does not exist.')
            sk.disconnect()
            return false
        }

        if (rooms[roomId].length >= 2) {
            // room is full; two users maximum
            sk.emit('full', 'Room is full.')
            sk.disconnect()
            return false
        }

        // join room
        sk.join(roomId)
        currentUser.room = roomId

        if (rooms[roomId].length == 1) {
            // there is already a user in the room
            // perform public key exchange
            var existingUser = rooms[roomId][0]
            var existingUserPubkey = existingUser.pubkey

            // send existing user's pubkey to the new user
            sk.emit('recv_pubkey', existingUserPubkey)
            // send new user's pubkey to the existing user
            sk.broadcast.to(existingUser.id).emit('recv_pubkey', currentUser.pubkey)
        }

        // save user to current users
        users[sk.id] = currentUser
        // add user to roomId
        rooms[roomId].push(currentUser)

        sk.on('relayMsg', (msg) => {
            // relay encrypted message to room
            var nick = users[sk.id].nick
            sk.to(roomId).emit('newMessage', nick, msg)
        })
    })

    sk.on('disconnect', () => {
        // if the user disconnects, destroy their room
        // and warn any other users of the room that a user has disconnected
        if (!(sk.id in users) || users[sk.id] === undefined) {
            return
        }

        let roomId = users[sk.id].room
        let nick = users[sk.id].nick

        sk.to(roomId).emit('warn', nick + ' has disconnected. This room has been closed.')
        sk.to(roomId).emit('roomClosed')

        delete rooms[roomId]
        delete users[sk.id]
    })

    sk.on('get_users', (roomId) => {
        for (let user in rooms[roomId]) {
            sk.emit('warn', rooms[roomId][user].nick + ' joined the room.')
        }
    })
})

export { server }
