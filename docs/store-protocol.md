# Store Protocol

The Store system is a way to store data in a binary format.

## Protocol

### Types

All types are big-endian, unless otherwise stated (one example is varints).

| Name      | Type ID   | Description |
| -         | -         | - |
| `u8/i8`   | `0`       | An (un)signed 8-bit integer |
| `u16/i16` | `1`       | An (un)signed 16-bit integer |
| `u32/i32` | `2`       | An (un)signed 32-bit integer |
| `varint`  | `3`       | A variable integer. This is little endian |
| `string`  | `4`       | A utf-8 string prefixed by an unsigned short |

### Prefix

All `Store` files start with a structure containing two bytes.

| Name | Description |
| - | - |
| Version | The version of `Store` the file is encoded in; the current version is `1` |
| Compressed | `1` = compressed with zlib, `0` = not compressed |

### Elements

| Name | Type | Description |
| - | - | - |
| `Type` | `u8` | The type of element, which is defined [here](#types) |
| `Name` | `string` | The name of the element |
| `Value` | Varies | The data, depending on the type |