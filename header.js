"use strict";

var _ = require('lodash');
var FS = require('fs');
var GraphQL = require('graphql');
var ByteBuffer = require('bytebuffer');

var introspection = JSON.parse(FS.readFileSync('introspection_responce.json', 'utf-8'));
var schema = GraphQL.buildClientSchema(introspection.data);
var typeInfo = new GraphQL.TypeInfo(schema);

var query = GraphQL.parse(FS.readFileSync('./request.graphql', 'utf-8'));

//GraphQL.visit(query, {
//  enter(node) {
//    delete node.loc;
//  }
//});

var definitions = _.groupBy(query.definitions, 'name.value');
var operation = GraphQL.getOperationAST(query);

module.exports = function () {
  var header = new ByteBuffer();
  walk(operation, typeInfo, header);
  //console.log(header.toString());
  //console.log(header.toDebug(true));
  // FIXME:
  header.limit = header.offset;
  header.offset = 0;
  return header;
};

if (require.main === module) {
  var header = module.exports();
  process.stdout.write(header.toBinary(), 'binary');
  //FS.writeFileSync('/dev/stdout', header.toBinary(0, header.offset), 'binary');
}

function walk(node, typeInfo, header) {
  GraphQL.visit(node, GraphQL.visitWithTypeInfo(typeInfo, {
    Field(field) {
      var name = (field.alias ? field.alias : field.name).value;
      var type = typeInfo.getType();
      type = GraphQL.getNullableType(type);

      var arrayDimentions = 0;
      while (type instanceof GraphQL.GraphQLList) {
        ++arrayDimentions;
        type = type.ofType;
        type = GraphQL.getNullableType(type);
      }

      var isEnum = type instanceof GraphQL.GraphQLEnumType;
      var typeName;
      if (isEnum)
        typeName = 'Enum';
      else if (type instanceof GraphQL.GraphQLScalarType) {
        typeName = type.name;
      }
      else
        typeName = 'Object';

      // Symbols allowed in GraphQL names:
      // 0-9 0x30-0x39
      // A-Z 0x41-0x5A
      //  _  0x5F
      // a-z 0x61-0x7A
      header.writeUTF8String(name);

      var typeByte = 0x80 | ({
        'Enum':    0x01,
        'Boolean': 0x02,
        'Int':     0x03,
        'Float':   0x04,
        'String':  0x05,
        'ID':      0x05,
        'Object':  0x06
      }[typeName] << 3);

      //Array dimentions
      // 7 - mean it encoded in following bytes
      typeByte |= (arrayDimentions < 7 ? arrayDimentions : 7);

      header.writeByte(typeByte);

      if (arrayDimentions >= 7)
        header.writeVarint32(arrayDimentions - 7);

      if (isEnum) {
        // ',' beetwen values and ';' after last value
        var values = _(type.getValues()).map('name').join(',') + ';';
        header.writeUTF8String(values);
      }

      //TODO: mark begin/end of 'on' spread
      //TODO: check fragment type is type same
      //TODO: handle skip & include directives
      //TODO[optimisation]: Spread reference
      //TODO[optimisation]: make __typename Enum
    },
    SelectionSet: {
      leave(field) {
        header.writeByte(0x7D); //'}'
      }
    },
    FragmentSpread(spread) {
      var name = spread.name.value;
      walk(definitions[name], typeInfo, header);
    }
  }));
}

//console.log(JSON.stringify(definitions, null, 2));
//console.log(GraphQL.printSchema(schema));
