/* global nullapp */

nullapp.controller('IndexCtrl', function($scope) {
    $scope.createRoom = function () {
        window.location = '/new_chat'
    }
})
