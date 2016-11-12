"use strict";

var _ = require('lodash');
var FS = require('fs');
var ByteBuffer = require('bytebuffer');
var getHeader = require('./header.js');

var HeaderTypeShift  = 3;
var HeaderTypeMask   = 0x07 << HeaderTypeShift;

var HeaderTypeEnum   = 0x01 << HeaderTypeShift;
var HeaderTypeBool   = 0x02 << HeaderTypeShift;
var HeaderTypeInt    = 0x03 << HeaderTypeShift;
var HeaderTypeFloat  = 0x04 << HeaderTypeShift;
var HeaderTypeString = 0x05 << HeaderTypeShift;
var HeaderTypeObject = 0x06 << HeaderTypeShift;


var header = getHeader();
var data = JSON.parse(FS.readFileSync('introspection_responce.json', 'utf-8')).data;
var body = new ByteBuffer();
console.log(header.toDebug(true));
packObject(data);

function getName() {
  var str = null;
  var ch = header.readByte();
  while(!(ch & 0x80) && ch !== 0x3B && ch !== 0x2C) {
    str = (str || "") + String.fromCharCode(ch);
    ch = header.readByte();
  }

  --header.offset;
  console.log(str);
  return str;
}

function getEnumIndex(str) {
  var index = null;
  var i = 0;
  do {
    if (getName() === str)
      index = i;
    ++i;
  } while (header.readByte() != 0x3B /* ';' */);

  return index;
}

function unpackTypeByte() {
  var typeByte = header.readByte();
  var type = typeByte & HeaderTypeMask;
  var arrayDimention = typeByte & 0x07;
  if (arrayDimention === 7)
    arrayDimention = header.readVarint32() + 7;
  return type;
}

function isByteEqualTo(value) {
  if (header.readByte() !== value) {
    --header.offset;
    return false;
  }
  return true;
}

function skipRestOfField(type) {
  if (type === HeaderTypeEnum)
    getEnumIndex(null);
  else if (type === HeaderTypeObject) {
    do {
      getName();
      skipRestOfField(unpackTypeByte());
    } while (!isByteEqualTo(0x7D /* '}' */ ));
  }
}

function packObject(obj) {
  _.each(obj, (value, key) => {
    while(getName() !== key) {
      //shouldn't happend on test data
      console.log('Skip !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      skipRestOfField(unpackTypeByte());
    }

    var type = unpackTypeByte();
    packValue(type, value);
    console.log('========================================');
    console.log(body.toDebug(true));
  });
}

function packValue(type, value) {
  if (value === null) {
    //FIXME: handle float
    body.writeByte(0x80);
    skipRestOfField(type);
    return;
  }

  if (_.isArray(value)) {
    body.writeVarint32(value.length);
    if (value.length === 0) {
      skipRestOfField(type);
      return;
    }

    var saveOffset = header.offset;
    _.each(value, arrayValue => {
      header.offset = saveOffset;
      packValue(type, arrayValue);
    });
    return;
  }

  switch (type) {
    case HeaderTypeEnum:
      body.writeVarint32(getEnumIndex(value));
      break;
    case HeaderTypeBool:
      body.writeByte(value ? 0x01 : 0x00);
      break;
    case HeaderTypeInt:
      body.writeVarint32ZigZag(value);
      break;
    case HeaderTypeFloat:
      //TODO: think about Float32 or Float64
      body.writeFloat64(value);
      break;
    case HeaderTypeString:
      body.writeVString(value);
      break;
    case HeaderTypeObject:
      body.writeByte(0x00);
      packObject(value);
      console.log('Read last');
      console.log(header.readByte().toString(16)); //should be '}'
      break;
  }
}
//console.log(data);
