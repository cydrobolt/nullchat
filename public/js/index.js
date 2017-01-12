/* global nullapp, sjcl, _generateRandomKey */

nullapp.controller('IndexCtrl', function($scope) {
    $scope.generateRandomKey = function () {
        if (!sjcl.random.isReady()) {
            return false
        }

        // if ready, stop collectors
        sjcl.random.stopCollectors()
        // slice off final = symbol
        var rb64 = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0).slice(0, -1)
        return encodeURIComponent(rb64)
    }

    $scope.createRoom = function () {
        if (!sjcl.random.isReady()) {
            // if sjcl has not yet collected enough entropy
            $('.alerts')
                .append('<div class="alert alert-danger" role="alert">   <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button> More entropy is needed to perform this action. Use a modern browser or move your mouse around to generate entropy.</div>')
            return false
        }

        // generate nullchat room ID
        var roomKey = _generateRandomKey()
        // generate secure key to ensure key exchange integrity
        var exchangeKey = _generateRandomKey()

        window.location = '/chat/' + roomKey + '#' + exchangeKey
    }

    $scope.init = function () {
        // start entropy collector
        sjcl.random.startCollectors()
    }

    $scope.init()
})
