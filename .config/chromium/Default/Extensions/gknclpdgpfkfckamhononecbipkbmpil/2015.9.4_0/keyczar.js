/*
Copyright 2014 Lectorius, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Define keyczar as a module that can be loaded both by node require and a browser
/** @suppress {duplicate} */
var forge = forge || require('node-forge');
/** @suppress {duplicate} */
var keyczar_util = keyczar_util || require('./keyczar_util');

var keyczar = {};
(function() {
'use strict';

keyczar.TYPE_AES = 'AES';
keyczar.TYPE_RSA_PRIVATE = 'RSA_PRIV';
keyczar.TYPE_RSA_PUBLIC = 'RSA_PUB';
keyczar.PURPOSE_DECRYPT_ENCRYPT = 'DECRYPT_AND_ENCRYPT';
keyczar.PURPOSE_ENCRYPT = 'ENCRYPT';
keyczar.PURPOSE_VERIFY = 'VERIFY';
keyczar.PURPOSE_SIGN_VERIFY = 'SIGN_AND_VERIFY';
var STATUS_PRIMARY = 'PRIMARY';

// Java uses 4096, but C++ and Python use 2048.
var RSA_DEFAULT_BITS = 2048;
var AES_DEFAULT_BITS = 128;
var HMAC_DEFAULT_BITS = 256;

/**
@param {number=} size key length in bits
*/
function _generateAes(size) {
    if (!size) size = AES_DEFAULT_BITS;

    // generate random bytes for both AES and HMAC
    var keyBytes = forge.random.getBytes(size/8);
    var hmacBytes = forge.random.getBytes(HMAC_DEFAULT_BITS/8);
    return keyczar_util._aesFromBytes(keyBytes, hmacBytes);
}

/** Returns a new Keyczar key. Note: this is slow for RSA keys.
TODO: Support different types. Right now it generates asymmetric RSA keys.
TODO: Possibly generate the key in steps to avoid hanging a browser?
@param {string} type
@param {string=} purpose
@param {Object=} options
*/
keyczar.create = function(type, purpose, options) {
    if (!purpose) {
        purpose = keyczar.PURPOSE_DECRYPT_ENCRYPT;
    }
    if (!options) {
        options = {};
    }
    // TODO: Enforce a list of acceptable sizes
    if (!options.size) {
        options.size = null;
    }
    if (!options.name) {
        options.name = '';
    }

    var keyString = null;
    var size = options.size;
    if (type == keyczar.TYPE_RSA_PRIVATE) {
        if (!size) size = RSA_DEFAULT_BITS;

        var generator = forge.pki.rsa.createKeyPairGenerationState(size);
        // run until done
        forge.pki.rsa.stepKeyPairGenerationState(generator, 0);
        keyString = keyczar_util._rsaPrivateKeyToKeyczarJson(generator.keys.privateKey);
    } else if (type == keyczar.TYPE_AES) {
        keyString = _generateAes(size).toJson();
    } else {
        throw new Error('Unsupported key type: ' + type);
    }

    if (!(purpose == keyczar.PURPOSE_DECRYPT_ENCRYPT || purpose == keyczar.PURPOSE_SIGN_VERIFY)) {
        throw new Error('Unsupported purpose: ' + JSON.stringify(purpose, null, 2));
    }

    // Create the initial metadata
    var metadata = {
        name: options.name,
        purpose: purpose,
        type: type,
        encrypted: false,
        versions: [{
            exportable: false,
            status: STATUS_PRIMARY,
            versionNumber: 1
        }]
    };

    // TODO: This serializes/deserializes the keys; change _makeKeyczar to not parse strings?
    var data = {
        meta: JSON.stringify(metadata),
        "1": keyString
    };

    return _makeKeyczar(data);
};

// Return a new keyczar containing the public part of key, which must be an asymmetric key.
function _exportPublicKey(key) {
    var t = key.metadata.type;
    var p = key.metadata.purpose;
    if (!(t == keyczar.TYPE_RSA_PRIVATE && (p == keyczar.PURPOSE_DECRYPT_ENCRYPT || p == keyczar.PURPOSE_SIGN_VERIFY))) {
        throw new Error('Unsupported key type/purpose:' + t + '/' + p);
    }

    var publicPurpose = keyczar.PURPOSE_ENCRYPT;
    if (p == keyczar.PURPOSE_SIGN_VERIFY) {
        publicPurpose = keyczar.PURPOSE_VERIFY;
    }

    var metadata = {
        name: key.metadata.name,
        purpose: publicPurpose,
        type: keyczar.TYPE_RSA_PUBLIC,
        encrypted: false,
        // TODO: Probably should do a deep copy
        versions: key.metadata.versions
    };

    if (key.metadata.versions.length != 1) {
        throw new Error('TODO: Support key sets with multiple keys');
    }

    var primaryVersion = _getPrimaryVersion(key.metadata);

    var data = {
        meta: JSON.stringify(metadata)
    };
    data[String(primaryVersion)] = key.primary.exportPublicKeyJson();
    return _makeKeyczar(data);
}

/** Returns the key set contained in the JSON string serialized. If password is provided,
expects an encrypted key using a key derived from password.
@param {string} serialized key set in a JSON string.
@param {string=} password optional password used to encrypt the key.
*/
keyczar.fromJson = function(serialized, password) {
    var data = JSON.parse(serialized);
    return _makeKeyczar(data, password);
};

// find the primary version; ensure we don't have more than one
function _getPrimaryVersion(metadata) {
    var primaryVersion = null;
    for (var i = 0; i < metadata.versions.length; i++) {
        if (metadata.versions[i].status == STATUS_PRIMARY) {
            if (primaryVersion !== null) {
                throw new Error('Invalid key: multiple primary keys');
            }
            primaryVersion = metadata.versions[i].versionNumber;
        }
    }

    if (primaryVersion === null) {
        throw new Error('No primary key');
    }

    return primaryVersion;
}

var _PBE_CIPHER = 'AES128';
var _PBE_HMAC = 'HMAC_SHA1';
var _PBE_AES_KEY_BYTES = 16;

// PBKDF2 RFC 2898 recommends at least 8 bytes (64 bits) of salt
// http://tools.ietf.org/html/rfc2898#section-4
// but NIST recommends at least 16 bytes (128 bits; see Section 5.1)
// http://csrc.nist.gov/publications/nistpubs/800-132/nist-sp800-132.pdf
var _SALT_BYTES = 16;

// NIST suggests count to be 1000 as a minimum, but that seems poor.
// 4 GPUs can do 3M attempts/second with 1000 iterations. See:
// http://blog.agilebits.com/2013/04/16/1password-hashcat-strong-master-passwords/
// 10000 iterations; 7 mixed case random letters = 9 days to crack
// 10000 iterations; 9 mixed case random letters = 193 years days to crack
// C++ Keyczar uses 4096 iterations by default (crypto_factory.cc)
var MIN_ITERATION_COUNT = 10000;

// We use 50000 iterations by default to increase brute force difficulty
// 7 mixed case random letters = 41 days to crack
// 9 mixed case random letters = 867 years to crack

// Timings from Chrome 28.0.1500.71 on a 2GHz i7 Mac:
//   10000 iterations ~= 83 ms/derivation
//   20000 iterations ~= 167 ms/derivation
//   50000 iterations ~= 407 ms/derivation
var _DEFAULT_ITERATIONS = 50000;

function _deriveKey(password, salt, iterationCount) {
    // check ! > 0 so that it fails for undefined
    if (!(iterationCount > 0)) {
        throw new Error('Invalid iterationCount: ' + iterationCount);
    }
    return forge.pkcs5.pbkdf2(
        password, salt, iterationCount, _PBE_AES_KEY_BYTES, forge.md.sha1.create());
}

var PBE_DECRYPT_FAILED_MESSAGE = 'AES decryption failed (password incorrect or data is corrupt?)';
function _decryptKey(keyString, password) {
    var data = JSON.parse(keyString);

    // derive the password key
    if (data.cipher != _PBE_CIPHER) {
        throw new Error('Unsupported encryption cipher: ' + data.cipher);
    }
    if (data.hmac != _PBE_HMAC) {
        throw new Error('Unsupported key derivation function: ' + data.hmac);
    }
    var iv = keyczar_util.decodeBase64Url(data.iv);
    var salt = keyczar_util.decodeBase64Url(data.salt);
    var key = keyczar_util.decodeBase64Url(data.key);

    var derivedKey = _deriveKey(password, salt, data.iterationCount);

    // decrypt the key with the derived key
    var cipher = forge.aes.startDecrypting(derivedKey, iv, null);
    cipher.update(new forge.util.ByteBuffer(key));
    var success = cipher.finish();
    if (!success) {
        throw new Error(PBE_DECRYPT_FAILED_MESSAGE);
    }

    var decryptedKeyBytes = cipher.output.getBytes();
    // unfortunately, this PBE format has no HMAC, so this could be garbage.
    // However, it is VERY unlikely we'll get garbage that happens to be valid
    // UTF-8-encoded JSON. This sanity check is very likely to catch errors
    try {
        var decryptedKeyString = forge.util.decodeUtf8(decryptedKeyBytes);
        var decryptedJSON = JSON.parse(decryptedKeyString);
        return decryptedKeyString;
    } catch (e) {
        // almost certainly any error is a password error
        throw new Error(PBE_DECRYPT_FAILED_MESSAGE);
    }
}

function _encryptKey(keyString, password) {
    // derive the key
    var iterationCount = _DEFAULT_ITERATIONS;
    var salt = forge.random.getBytes(_SALT_BYTES);
    var derivedKey = _deriveKey(password, salt, iterationCount);

    var iv = forge.random.getBytes(_PBE_AES_KEY_BYTES);
    var cipher = forge.aes.startEncrypting(derivedKey, iv, null);
    cipher.update(new forge.util.ByteBuffer(keyString));
    var success = cipher.finish();
    if (!success) {
        throw new Error('AES encryption failed');
    }

    var output = {
        salt: keyczar_util.encodeBase64Url(salt),
        iterationCount: iterationCount,
        hmac: _PBE_HMAC,

        cipher: _PBE_CIPHER,
        iv: keyczar_util.encodeBase64Url(iv),
        key: keyczar_util.encodeBase64Url(cipher.output.getBytes())
    };
    return JSON.stringify(output);
}

// Returns a Keyczar object from data.
/**
@param {*} data Deserialized JSON object containing the key
@param {string=} password Used to encrypt the key
*/
function _makeKeyczar(data, password) {
    var instance = {};

    instance.metadata = JSON.parse(data.meta);
    if (instance.metadata.encrypted !== false) {
        if (!password) {
            throw new Error('Key is encrypted; you must provide the password');
        }
        if (password.length === 0) {
            throw new Error('Must supply a password length > 0');
        }
    } else if (password) {
        throw new Error('Key is not encrypted but password provided');
    }

    var primaryVersion = _getPrimaryVersion(instance.metadata);
    var primaryKeyString = data[String(primaryVersion)];
    if (instance.metadata.encrypted) {
        primaryKeyString = _decryptKey(primaryKeyString, password);
    }

    var t = instance.metadata.type;
    var p = instance.metadata.purpose;
    if (t == keyczar.TYPE_RSA_PRIVATE) {
        instance.primary = keyczar_util.privateKeyFromKeyczar(primaryKeyString);
        instance.exportPublicKey = function() { return _exportPublicKey(instance); };
    } else if (t == keyczar.TYPE_RSA_PUBLIC) {
        instance.primary = keyczar_util.publicKeyFromKeyczar(primaryKeyString);
    } else if (t == keyczar.TYPE_AES && p == keyczar.PURPOSE_DECRYPT_ENCRYPT) {
        instance.primary = keyczar_util.aesFromKeyczar(primaryKeyString);
    } else {
        throw new Error('Unsupported key type: ' + t);
    }

    if (p == keyczar.PURPOSE_ENCRYPT || p == keyczar.PURPOSE_DECRYPT_ENCRYPT) {
        // Takes a raw byte string, returns a raw byte string
        instance.encryptBinary = function(plaintext) {
            // TODO: assert that plaintext does not contain special characters
            return instance.primary.encrypt(plaintext);
        };

        instance.encrypt = function(plaintext) {
            // encode as UTF-8 in case plaintext contains non-ASCII characters
            plaintext = forge.util.encodeUtf8(plaintext);
            var message = instance.encryptBinary(plaintext);
            message = keyczar_util.encodeBase64Url(message);
            return message;
        };

        // only include decryption if supported by this key type
        if (p == keyczar.PURPOSE_DECRYPT_ENCRYPT) {
            instance.decryptBinary = function(message) {
                return instance.primary.decrypt(message);
            };

            instance.decrypt = function(message) {
                message = keyczar_util.decodeBase64Url(message);
                var plaintext = instance.primary.decrypt(message);
                plaintext = forge.util.decodeUtf8(plaintext);
                return plaintext;
            };
        }
    } else if (p == keyczar.PURPOSE_VERIFY || p == keyczar.PURPOSE_SIGN_VERIFY) {
        instance.verify = function(message, signature) {
            message = forge.util.encodeUtf8(message);
            signature = keyczar_util.decodeBase64Url(signature);
            return instance.primary.verify(message, signature);
        };

        if (p == keyczar.PURPOSE_SIGN_VERIFY) {
            instance.sign = function(message) {
                message = forge.util.encodeUtf8(message);
                var signature = instance.primary.sign(message);
                return keyczar_util.encodeBase64Url(signature);
            };
        }
    }

    var _toJsonObject = function() {
        var out = {};
        out.meta = JSON.stringify(instance.metadata);

        // TODO: Store and serialize ALL keys. For now this works
        if (instance.metadata.versions.length != 1) {
            throw new Error('TODO: Support keyczars with multiple keys');
        }
        var primaryVersion = _getPrimaryVersion(instance.metadata);
        out[String(primaryVersion)] = instance.primary.toJson();
        return out;
    };

    // Returns the JSON serialization of this keyczar instance.
    instance.toJson = function() {
        if (instance.metadata.encrypted) {
            throw new Error('Key is encrypted; use toJsonEncrypted() instead');
        }
        var out = _toJsonObject();
        return JSON.stringify(out);
    };

    // Returns the decrypted version of this password-protected key.
    // WARNING: This is dangerous as it can be used to leak a password-protected key
    instance.exportDecryptedJson = function() {
        if (!instance.metadata.encrypted) {
            throw new Error('Key is not encrypted; use toJson() instead');
        }

        var unencrypted = _toJsonObject();

        // hack the metadata to mark it as unencrypted
        var meta = JSON.parse(unencrypted.meta);
        meta.encrypted = false;
        unencrypted.meta = JSON.stringify(meta);
        return JSON.stringify(unencrypted);
    };

    instance.toJsonEncrypted = function(password) {
        // TODO: Enforce some sort of minimum length?
        if (password.length === 0) {
            throw new Error('Password length must be > 0');
        }

        // get the unencrypted JSON object
        var unencrypted = _toJsonObject();

        // set metadata.encrypted = true
        var meta = JSON.parse(unencrypted.meta);
        meta.encrypted = true;
        unencrypted.meta = JSON.stringify(meta);

        // encrypt each key
        for (var property in unencrypted) {
            if (property == 'meta') continue;
            unencrypted[property] = _encryptKey(unencrypted[property], password);
        }

        return JSON.stringify(unencrypted);
    };

    return instance;
}

/**
@param {*} key key used to encrypt the session key
@param {string=} sessionMaterial existing session material for decryption
*/
keyczar.createSessionCrypter = function(key, sessionMaterial) {
    if (key.metadata.type != keyczar.TYPE_RSA_PRIVATE && key.metadata.type != keyczar.TYPE_RSA_PUBLIC) {
        throw new Error('Invalid key type for SessionCrypter: ' + key.metadata.type);
    }

    var sessionKey = null;
    var rawSessionMaterial = null;
    if (sessionMaterial) {
        // decrypt session key: not base64 encoded if leading byte is VERSION_BYTE
        if (sessionMaterial.charAt(0) == keyczar_util.VERSION_BYTE) {
            rawSessionMaterial = sessionMaterial;
        } else {
            rawSessionMaterial = keyczar_util.decodeBase64Url(sessionMaterial);
        }
        var decrypted = key.decryptBinary(rawSessionMaterial);
        var keyBytes = keyczar_util._unpackByteStrings(decrypted);

        sessionKey = keyczar_util._aesFromBytes(keyBytes[0], keyBytes[1]);
    } else {
        // generate the session key
        sessionKey = _generateAes();

        // encrypt the key
        var packed = sessionKey.pack();
        rawSessionMaterial = key.encryptBinary(packed);
    }

    var crypter = {
        rawSessionMaterial: rawSessionMaterial,
        sessionMaterial: keyczar_util.encodeBase64Url(rawSessionMaterial)
    };

    crypter.encryptBinary = function(plaintext) {
        // TODO: assert that plaintext has no special chars
        return sessionKey.encrypt(plaintext);
    };

    crypter.decryptBinary = function(message) {
        return sessionKey.decrypt(message);
    };

    sessionKey.sessionMaterial = sessionMaterial;
    return crypter;
};

// Returns a byte string containing (session material, session encryption).
// Convenience wrapper around a SessionCrypter.
keyczar.encryptWithSession = function(key, message) {
    var crypter = keyczar.createSessionCrypter(key);
    message = forge.util.encodeUtf8(message);
    var rawEncrypted = crypter.encryptBinary(message);
    var packed = keyczar_util._packByteStrings([crypter.rawSessionMaterial, rawEncrypted]);
    return keyczar_util.encodeBase64Url(packed);
};

keyczar.decryptWithSession = function(key, message) {
    message = keyczar_util.decodeBase64Url(message);
    var unpacked = keyczar_util._unpackByteStrings(message);
    var crypter = keyczar.createSessionCrypter(key, unpacked[0]);
    var plaintext = crypter.decryptBinary(unpacked[1]);
    return forge.util.decodeUtf8(plaintext);
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = keyczar;
}
})();
