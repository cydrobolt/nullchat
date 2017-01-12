/* global nullapp, io, openpgp, roomId */

const ENTER_KEY = 13
const RSA_KEY_SIZE = 2048

nullapp.directive('chatItem', function() {
    return {
        scope: {
            nick: '@',
            text: '@',
            time: '@'
        },
        replace: true,
        templateUrl: '/directives/chatItem.html'
    }
})

nullapp.controller('NullCtrl', function($scope, $compile, $q) {
    $scope.state = {
        nick: null,
        loaded: false,
        loadingMsg: 'generating encryption keys',
        roomId: roomId,
        targetJoined: false
    }

    $scope.sk = null

    $scope.keys = {
        privkey: null, // own private key for decryption
        pubkey: null, // own public key for encryption
        targetPubkey: null // public key of target user
    }

    $scope.isScrolledToBottom = function (el) {
        return el.scrollHeight - el.clientHeight <= el.scrollTop + 1
    }

    $scope.scrollToBottom = function ($el) {
        // ensures chat history is scrolled to bottom
        $el.animate({scrollTop: $el.prop('scrollHeight')}, 500)
    }

    $scope.appendMessage = function (nick, text) {
        var nickClass = 'message-other'

        if (nick == $scope.state.nick) {
            // if message from self
            nickClass = 'message-self'
        }
        else if (nick == 'System') {
            nickClass = 'message-system'
        }

        var currTime = (new Date()).toLocaleTimeString()
        var messageEl = $compile('<tr class="' + nickClass + '" nick="' + nick + '" time="' + currTime + '" text="' + text + '" chat-item></tr>')($scope)
        var $chatHistory = $('.chat-history')

        var scrolledToBottom = $scope.isScrolledToBottom($chatHistory.get(0))
        $('.chat-item table tbody').append(messageEl)
        if (scrolledToBottom) {
            $scope.scrollToBottom($chatHistory)
        }
    }

    $scope.generateKeys = function () {
        var deferred = $q.defer()

        var options = {
            userIds: [{ name:'nullchat', email:'nullchat@cydrobolt.com' }],
            numBits: RSA_KEY_SIZE // RSA key size
        }

        openpgp.generateKey(options).then(function(key) {
            // set keys to scope variables
            $scope.keys.privkey = key.privateKeyArmored
            $scope.keys.pubkey = key.publicKeyArmored

            // completed loading
            $scope.$apply()

            deferred.resolve()
        })

        return deferred.promise
    }

    $scope.encryptForTarget = function(message) {
        var deferred = $q.defer()

        var options = {
            data: message,
            publicKeys: openpgp.key.readArmored($scope.keys.targetPubkey).keys,
            privateKeys: openpgp.key.readArmored($scope.keys.privkey).keys,
            armor: true
        }

        openpgp.encrypt(options).then(function(ciphertext) {
            var encryptedAsc = ciphertext.data
            deferred.resolve(encryptedAsc)
        })

        return deferred.promise
    }

    $scope.decryptForSelf = function (message) {
        var deferred = $q.defer()

        var options = {
            message: openpgp.message.readArmored(message),
            publicKeys: openpgp.key.readArmored($scope.keys.targetPubkey).keys, // verify that the sender is correct
            privateKey: openpgp.key.readArmored($scope.keys.privkey).keys[0],
            format: 'utf8'
        }

        openpgp.decrypt(options).then(function(plaintext) {
            deferred.resolve(plaintext)
        })

        return deferred.promise
    }

    $scope.connect = function () {
        $scope.sk = io()
        $scope.state.loadingMsg = 'exchanging keypair'

        $scope.sk.on('welcome', function (nick) {
            $scope.state.nick = nick
            $scope.appendMessage($scope.state.nick, 'you joined.')

            $scope.sk.emit('pubkey', $scope.keys.pubkey)
            $scope.sk.emit('joinRoom', $scope.state.roomId)

            $scope.state.loadingMsg = 'awaiting target key exchange'
            $scope.$apply()
        })

        $scope.sk.on('recv_pubkey', function (targetPubkey) {
            $scope.keys.targetPubkey = targetPubkey

            // wait for pubkey to be exchanged with target
            // before removing preloader
            $scope.state.loaded = true
            $scope.$apply()

            // request a list of users
            $scope.sk.emit('get_users', $scope.state.roomId)
        })

        $scope.sk.on('newMessage', function (nick, encryptedMessage) {
            if (nick == $scope.state.nick) {
                // return if message is from ourselves
                // TODO nick collisions
                return false
            }

            var decryptMessageDeferred = $scope.decryptForSelf(encryptedMessage)
            decryptMessageDeferred.then(function (plaintextMessage) {
                $scope.appendMessage(nick, plaintextMessage.data)
            })
        })

        $scope.sk.on('warn', function (err) {
            $scope.appendMessage('System', err)
        })

        $scope.sk.on('full', function (err) {
            // if room is full
            $scope.state.loadingMsg = err
            $scope.state.loadingErr = true

            $scope.$apply()
        })

        $scope.sk.on('disconnect', function () {
            $scope.appendMessage('System', 'Disconnected.')
            if (!$scope.state.loadingErr) {
                // apply generic loading error
                // only if a more specific error has not already been applied
                $scope.state.loaded = false
                $scope.state.loadingMsg = 'disconnected from the server'
                $scope.state.loadingErr = true
                $scope.$apply()
                // don't reconnect
                $scope.sk.disconnect()
            }
        })

        /* chat controls */
        $('.chat-input').keypress(function (e) {
            if (e.which == ENTER_KEY) {
                var messageToSend = $(this).val()
                $(this).val('')

                // encrypt message
                var messageToSendEncrypted = $scope.encryptForTarget(messageToSend)
                messageToSendEncrypted.then(function (encMsgAsc) {
                    $scope.sk.emit('relayMsg', encMsgAsc)
                    $scope.appendMessage($scope.state.nick, messageToSend)
                })

                return false
            }
        })
        $('.chat-input').focus()
    }

    $scope.init = function () {
        console.log('initializing openpgp')
        openpgp.initWorker({ path: '/static/js/vendor/openpgp.worker.min.js' })

        // generate pgp keypair
        var generateKeyDefer = $scope.generateKeys()
        // connect and exchange public keys
        generateKeyDefer.then(function () {
            $scope.state.loadingMsg = 'connecting to server'
            $scope.connect()
        })
    }

    $scope.init()
})
