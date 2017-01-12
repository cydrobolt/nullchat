/* global angular, sjcl */

var nullapp = angular.module('nullapp', [])

function _generateRandomKey () {
    if (!sjcl.random.isReady()) {
        return false
    }

    // if ready, stop collectors
    sjcl.random.stopCollectors()
    // slice off final = symbol
    var rb64 = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0).slice(0, -1)
    return encodeURIComponent(rb64)
}
