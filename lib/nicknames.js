import _ from 'lodash'

let adjectives = [
    'adaptable',
    'adventurous',
    'ambitious',
    'amiable',
    'compassionate',
    'considerate',
    'courageous',
    'diligent',
    'generous',
    'inventive',
    'rational',
    'practical'
]

let animals = [
    'alligator',
    'ant',
    'bat',
    'bear',
    'beaver',
    'bird',
    'bison',
    'cat',
    'deer',
    'duck',
    'koala',
    'leopard',
    'rabbit',
    'zebra'
]

function chooseWord(arr) {
    return _.capitalize(
        _.sample(arr)
    )
}

export function getNick() {
    return chooseWord(adjectives) + ' ' + chooseWord(animals)
}
