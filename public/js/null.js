/* global nullapp, io, sjcl, openpgp,
    ROOM_ID, _generateRandomKey, ifvisible, RSA_KEY_SIZE */

const ENTER_KEY = 13

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
        loadingErr: false,
        errDetail: '',
        roomId: ROOM_ID,
        targetJoined: false,
        blockInput: false,
        unreadMsg: 0
    }

    $scope.sk = null

    $scope.keys = {
        privkey: null, // own private key for decryption
        pubkey: null, // own public key for encryption
        targetPubkey: null // public key of target user
    }
    $scope.exchangeKey = window.location.hash.substr(1)

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

            $scope.state.loadingMsg = 'waiting for target to join'
            $scope.state.errDetail = 'share this link to invite target to room'
            $scope.$apply()
        })

        $scope.sk.on('recv_pubkey', function (targetPubkey) {
            if ($scope.keys.targetPubkey) {
                // if a key has already been saved, refuse to accept a new key
                return false
            }

            $scope.keys.targetPubkey = targetPubkey
            $scope.state.errDetail = ''
            $scope.state.loadingMsg = 'verifying key exchange'
            $scope.$apply()

            // verify integrity of key exchange
            var nonce = _generateRandomKey()
            // hash the exchange key with the nonce
            console.log(sjcl.codec.hex.fromBits(sjcl.hash.sha256.hash($scope.exchangeKey + nonce)))

            $scope.encryptForTarget(
                sjcl.codec.hex.fromBits(
                    sjcl.hash.sha256.hash($scope.exchangeKey + nonce)
                )
            ).then(function (hashedExchangeKey) {
                // pass to the server the hashed key with the nonce used
                $scope.sk.emit('sendExchangeKey', hashedExchangeKey, nonce)
            })

            $scope.sk.on('validateExchange', function(nick, encRecvExchangeKey, recvNonce) {
                if (nick == $scope.state.nick) {
                    return
                }

                if (recvNonce.length < 5 || recvNonce == nonce) {
                    // fail the key exchange if the received nonce is the same
                    // as the sent nonce or if the nonce is too short
                    $scope.state.loadingMsg = 'could not verify key exchange'
                    $scope.state.errDetail = 'the server may be compromised or your link is incorrect'
                    $scope.state.loadingErr = true

                    $scope.sk.disconnect()
                    $scope.$apply()
                    return false
                }

                var expectedRecvExchangeKey = sjcl.codec.hex.fromBits(
                    sjcl.hash.sha256.hash($scope.exchangeKey + recvNonce)
                )

                console.log(encRecvExchangeKey)

                $scope.decryptForSelf(encRecvExchangeKey)
                    .then(function (recvExchangeKey) {
                        console.log('expected', expectedRecvExchangeKey)
                        console.log('actual', recvExchangeKey)

                        if (expectedRecvExchangeKey == recvExchangeKey.data) {
                            // key exchange is verified
                            $scope.state.loaded = true

                            $scope.$apply()
                        }
                        else {
                            // key exchange is invalid
                            // TODO abort
                            $scope.state.loadingMsg = 'could not verify key exchange'
                            $scope.state.errDetail = 'the server may be compromised or your link is incorrect'
                            $scope.state.loadingErr = true
                            $scope.$apply()

                            $scope.sk.disconnect()
                            return false
                        }
                    })
            })

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
                console.log(ifvisible.now())
                if (!ifvisible.now()) {
                    // if screen is not in focus
                    $scope.state.unreadMsg += 1
                    $scope.$digest()
                }

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

        $scope.sk.on('roomClosed', function (err) {
            // if room has been closed
            $scope.state.blockInput = true
            $scope.$apply()
        })

        $scope.sk.on('disconnect', function () {
            $scope.appendMessage('System', 'Disconnected.')
            if (!$scope.state.loadingErr) {
                // apply generic loading error
                // only if a more specific error has not already been applied
                $scope.state.loaded = false
                $scope.state.loadingMsg = 'disconnected from the server'
                $scope.state.errDetail = ''
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
        sjcl.random.startCollectors()

        // generate pgp keypair
        var generateKeyDefer = $scope.generateKeys()
        // connect and exchange public keys
        generateKeyDefer.then(function () {
            $scope.state.loadingMsg = 'connecting to server'
            $scope.connect()
        })

        $scope.$watch('state.unreadMsg', function (nv, ov) {
            if ($scope.state.unreadMsg > 0) {
                // new unread message
                document.title = '(' + $scope.state.unreadMsg + ') null'
            }
            else {
                // unread messages cleared
                document.title = 'null'
            }
        }, true)


        ifvisible.on('focus', function() {
            $scope.state.unreadMsg = 0
            $scope.$digest()
        })

        ifvisible.now()
    }

    $scope.init()
})
