/**
 * Client-side decryption for PyCryptodome AES-256-CBC + HMAC
 */

class APIDecryption {
    constructor() {
        this.keyCache = new Map();
        this.masterKey = null;
        this.salt = 'netflix_checker_salt_v1';
    }

    async initialize(masterKeyBase64) {
        try {
            const keyBytes = this.base64ToArrayBuffer(masterKeyBase64);
            this.masterKey = new Uint8Array(keyBytes);
            return true;
        } catch (error) {
            console.error('Failed to initialize:', error);
            return false;
        }
    }

    async deriveKey(fieldName) {
        const cacheKey = fieldName;
        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey);
        }

        try {
            // PBKDF2 using Web Crypto API
            const encoder = new TextEncoder();
            const passwordBuffer = new Uint8Array([...this.masterKey, ...encoder.encode(fieldName)]);
            
            const importedKey = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );

            const saltBuffer = encoder.encode(this.salt);
            
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                importedKey,
                256
            );

            const key = await crypto.subtle.importKey(
                'raw',
                derivedBits,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );

            this.keyCache.set(cacheKey, key);
            return key;
        } catch (error) {
            console.error(`Key derivation failed:`, error);
            throw error;
        }
    }

    async decryptField(encryptedPayload) {
        if (!encryptedPayload || !encryptedPayload.e) {
            return encryptedPayload?.value || encryptedPayload;
        }

        try {
            const { v: ciphertextB64, i: ivB64, f: fieldName } = encryptedPayload;
            
            const ciphertext = this.base64ToArrayBuffer(ciphertextB64);
            const iv = this.base64ToArrayBuffer(ivB64);
            
            const key = await this.deriveKey(fieldName);
            
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-CBC',
                    iv: iv
                },
                key,
                ciphertext
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return '[decryption_failed]';
        }
    }

    async decryptResponse(data) {
        if (!data || typeof data !== 'object') return data;

        const decrypted = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object') {
                if (value.e === true) {
                    decrypted[key] = await this.decryptField(value);
                } else if (key === 'login_urls' && typeof value === 'object') {
                    decrypted[key] = {};
                    for (const [urlKey, urlValue] of Object.entries(value)) {
                        if (urlValue && urlValue.e === true) {
                            decrypted[key][urlKey] = await this.decryptField(urlValue);
                        } else {
                            decrypted[key][urlKey] = urlValue;
                        }
                    }
                } else {
                    decrypted[key] = await this.decryptResponse(value);
                }
            } else {
                decrypted[key] = value;
            }
        }

        return decrypted;
    }

    async processResponse(apiResponse) {
        if (!apiResponse || !apiResponse.encrypted) return apiResponse;

        try {
            const decryptedData = await this.decryptResponse(apiResponse.data);
            return {
                ...apiResponse,
                data: decryptedData,
                decrypted: true
            };
        } catch (error) {
            console.error('Decryption failed:', error);
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

window.apiCrypto = new APIDecryption();
