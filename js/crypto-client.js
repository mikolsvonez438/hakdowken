/**
 * Client-side decryption module using Web Crypto API
 * Matches server-side Pure Python encryption
 */

class APIDecryption {
    constructor() {
        this.keyCache = new Map();
        this.masterKey = null;
        this.salt = 'netflix_checker_salt_v1';
    }

    async initialize(masterKeyBase64) {
        try {
            // Remove padding if present and decode
            const cleanKey = masterKeyBase64.replace(/=/g, '');
            const keyBytes = this.base64ToArrayBuffer(cleanKey + '=='.substring(0, (4 - cleanKey.length % 4) % 4));
            this.masterKey = new Uint8Array(keyBytes);
            return true;
        } catch (error) {
            console.error('Failed to initialize decryption:', error);
            return false;
        }
    }

    async deriveKey(fieldName) {
        const cacheKey = fieldName;
        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey);
        }

        try {
            // Build key material: masterKey + fieldName
            const encoder = new TextEncoder();
            const fieldBytes = encoder.encode(fieldName);
            const combined = new Uint8Array(this.masterKey.length + fieldBytes.length);
            combined.set(this.masterKey);
            combined.set(fieldBytes, this.masterKey.length);

            // Import for PBKDF2
            const baseKey = await crypto.subtle.importKey(
                'raw',
                combined,
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );

            const saltBuffer = encoder.encode(this.salt);
            
            // Derive 256 bits
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                baseKey,
                256
            );

            // Import as AES-CBC key
            const aesKey = await crypto.subtle.importKey(
                'raw',
                derivedBits,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );

            this.keyCache.set(cacheKey, aesKey);
            return aesKey;
        } catch (error) {
            console.error(`Key derivation failed for ${fieldName}:`, error);
            throw error;
        }
    }

    async decryptField(encryptedPayload) {
        if (!encryptedPayload || encryptedPayload.e !== true) {
            return encryptedPayload?.value || encryptedPayload;
        }

        try {
            const { v: ciphertextB64, i: ivB64, f: fieldName } = encryptedPayload;
            
            // Handle potential padding issues
            const cleanCipher = ciphertextB64.replace(/=/g, '');
            const cleanIv = ivB64.replace(/=/g, '');
            
            const ciphertext = this.base64ToArrayBuffer(
                cleanCipher + '=='.substring(0, (4 - cleanCipher.length % 4) % 4)
            );
            const iv = this.base64ToArrayBuffer(
                cleanIv + '=='.substring(0, (4 - cleanIv.length % 4) % 4)
            );
            
            const key = await this.deriveKey(fieldName);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-CBC',
                    iv: new Uint8Array(iv)
                },
                key,
                ciphertext
            );

            // Remove PKCS7 padding manually
            const decryptedBytes = new Uint8Array(decrypted);
            const paddingLength = decryptedBytes[decryptedBytes.length - 1];
            const unpadded = decryptedBytes.slice(0, decryptedBytes.length - paddingLength);
            
            return new TextDecoder().decode(unpadded);
        } catch (error) {
            console.error('Decryption failed for field:', encryptedPayload.f, error);
            return '[decryption_failed]';
        }
    }

    async decryptResponse(data) {
        if (!data || typeof data !== 'object') return data;

        const decrypted = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object') {
                // Check if this is an encrypted field (has 'e': true)
                if (value.e === true && value.v && value.i) {
                    decrypted[key] = await this.decryptField(value);
                } else if (key === 'login_urls' && typeof value === 'object' && !Array.isArray(value)) {
                    // Handle nested login_urls object
                    decrypted[key] = {};
                    for (const [urlKey, urlValue] of Object.entries(value)) {
                        if (urlValue && urlValue.e === true) {
                            decrypted[key][urlKey] = await this.decryptField(urlValue);
                        } else {
                            decrypted[key][urlKey] = urlValue;
                        }
                    }
                } else if (Array.isArray(value)) {
                    // Handle arrays
                    decrypted[key] = await Promise.all(
                        value.map(async (item) => {
                            if (typeof item === 'object') {
                                return await this.decryptResponse(item);
                            }
                            return item;
                        })
                    );
                } else {
                    // Recurse into nested objects
                    decrypted[key] = await this.decryptResponse(value);
                }
            } else {
                decrypted[key] = value;
            }
        }

        return decrypted;
    }

    async processResponse(apiResponse) {
        if (!apiResponse || apiResponse.encrypted !== true) {
            return apiResponse;
        }

        try {
            const decryptedData = await this.decryptResponse(apiResponse.data);
            return {
                ...apiResponse,
                data: decryptedData,
                decrypted: true
            };
        } catch (error) {
            console.error('Failed to process encrypted response:', error);
            throw error;
        }
    }

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    clearCache() {
        this.keyCache.clear();
        this.masterKey = null;
    }
}

// Global instance
const apiCrypto = new APIDecryption();
window.apiCrypto = apiCrypto;
