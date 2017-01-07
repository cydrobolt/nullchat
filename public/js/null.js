/* global nullapp, io, openpgp, roomId */

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
        roomId: roomId
    }

    $scope.sk = null

    $scope.keys = {
        privkey: null, // own private key for decryption
        pubkey: null, // own public key for encryption
        targetpubkey: null // public key of target user
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

        var currTime = (new Date()).toLocaleTimeString()
        var messageEl = $compile('<tr class="' + nickClass + '" nick="' + nick + '" time="' + currTime + '" text="' + text + '" chat-item></tr>')($scope)
        var $chatHistory = $('.chat-history')

        var scrolledToBottom = $scope.isScrolledToBottom($chatHistory.get(0))
        $('.chat-item table tbody').append(messageEl)
        if (scrolledToBottom) {
            console.log('was scrolled b4')
            $scope.scrollToBottom($chatHistory)
        }
    }

    $scope.generateKeys = function () {
        var deferred = $q.defer()

        var options = {
            userIds: [{ name:'nullchat', email:'nullchat@cydrobolt.com' }],
            numBits: 4096 // RSA key size
        }

        openpgp.generateKey(options).then(function(key) {
            // set keys to scope variables
            $scope.keys.privkey = key.privateKeyArmored
            $scope.keys.pubkey = key.publicKeyArmored

            // completed loading
            $scope.$apply()
            console.log($scope.keys)

            deferred.resolve()
        })

        return deferred.promise
    }

    $scope.connect = function () {
        $scope.sk = io()
        $scope.state.loadingMsg = 'exchanging keypair'

        $scope.sk.on('welcome', function (nick) {
            $scope.state.nick = nick
            $scope.state.loaded = true
            $scope.appendMessage($scope.state.nick, 'Joined.')
            $scope.$apply()

            $scope.sk.emit('roomId', $scope.state.roomId)
            $scope.sk.emit('pubkey', $scope.keys.pubkey)
        })
    }

    $scope.init = function () {
        $('.chat-input').keypress(function (e) {
            if (e.which == ENTER_KEY) {
                var messageToSend = $(this).val()
                $(this).val('')

                console.log('received request to send ' + messageToSend)
                $scope.appendMessage($scope.state.nick, messageToSend)
                return false
            }
        })
        $('.chat-input').focus()

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
