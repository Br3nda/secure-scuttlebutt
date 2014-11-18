var tape = require('tape')
var defaults = require('../defaults')

function copy (buf) {
  var _buf = new Buffer(buf.length)
  buf.copy(_buf)
  return _buf
}

function isString(s) {
  return 'string' === typeof s
}

function isHash (data) {
  return isString(data) && /^[A-Za-z0-9\/+]{43}=\.blake2s$/.test(data)
  //return Buffer.isBuffer(data) && data.length == 32
}

function randint (n) {
  return ~~(Math.random()*n)
}

function decodeHash(hash) {
  if(!isHash(hash)) throw new Error('sign expects a hash')
  return new Buffer(hash.substring(0, 44), 'base64')
}

function encodeHash (buf) {
  return buf.toString('base64') +'.blake2s'
}

function flipRandomBit(buf) {
    if(isHash(buf))
      return encodeHash(flipRandomBit(decodeHash(buf)))
    buf = copy(buf)
    var r = randint(buf.length)
    //change one bit
    buf[r] = buf[r] ^ (1 << randint(7))
    return buf
}

function clone (obj) {
  var o = {}
  for(var k in obj) o[k] = obj[k]
  return o
}

function noop () {}

function b(s) {
  return s
}

module.exports = function (opts) {

  var validation = require('../validation')({sublevel: noop}, opts)
  var create = require('../message')(opts)

  var empty = opts.hash(new Buffer(0))
  var zeros = new Buffer(empty.length)
  zeros.fill(0)

  tape('encode/decode', function (t) {
    var keys = opts.keys.generate()

    var msg = create(keys, b('init'), new Buffer([0,1,2,3,4,5,6,7,8]))
    var encoded = opts.codec.encode(msg)
    var _msg = opts.codec.decode(encoded)
    t.deepEqual(_msg, msg)
    t.end()
  })

  // encode, hash, sign, verify
  tape('simple', function (t) {

    var keys = opts.keys.generate()

    var msg = create(keys, b('init'), keys.public)

    var encoded = opts.codec.encode(msg)
    var hash = opts.hash(encoded)
    var sig = opts.keys.sign(keys, hash)

    opts.keys.verify(keys, sig, hash)

    for(var i = 0; i < 3; i++) {
      t.notOk(opts.keys.verify(keys, flipRandomBit(sig), hash))
      t.notOk(opts.keys.verify(keys, sig, flipRandomBit(hash)))

      var _keys = opts.keys.generate()
      t.notOk(opts.keys.verify(_keys, sig, hash))
    }
    t.end()
  })

  tape('validate 1 message', function (t) {

    var keys = opts.keys.generate()

    var msg = create(keys,
      b('init'),   //type
      keys.public, //message
      null         //previous
    )

    var msg2 = create(keys, b('msg'), 'hello', msg)

    console.log(msg)
    console.log(msg2)

    //should this throw?
    t.ok(validation.validateSync(msg, null, keys), 'initial message')
    t.equal(validation.validateSync.reason, '')
    t.end()
  })

  tape('validate multiple messages', function (t) {

    var keys = opts.keys.generate()

    var msg = create(keys,
      b('init'),      //type
      keys.public, //message
      null         //previous
    )

    var msg2 = create(keys, b('msg'), 'hello', msg)

    console.log(msg)
    console.log(msg2)

    //should this throw?
    t.ok(validation.validateSync(msg, null, keys), 'initial message')
    t.ok(validation.validateSync(msg2, msg, keys), 'second message')

    for(var i = 0; i < 10; i++) {
      var _msg
      _msg = clone(msg2)
      _msg.signature = flipRandomBit(_msg.signature)
      t.notOk(validation.validateSync(_msg, msg, keys))

      _msg = clone(msg2)
      _msg.previous = flipRandomBit(_msg.previous)
      _msg = create.sign(_msg, keys)
      t.notOk(validation.validateSync(_msg, msg, keys))

      _msg = clone(msg2)
      _msg.author = flipRandomBit(_msg.author)
      _msg = create.sign(_msg, keys)
      t.notOk(validation.validateSync(_msg, msg, keys))
    }

    t.end()
  })

}

if(!module.parent)
  module.exports(require('../defaults'))
