/**
 * Client-side decryption module using Web Crypto API
 * Matches server-side AES-256-GCM encryption
 */

class APIDecryption {
    constructor() {
        this.keyCache = new Map();
        this.masterKey = null;
        this.salt = 'netflix_checker_salt_v1';
    }

    /**
     * Initialize with master key from server (delivered securely after auth)
     * In production, this should be delivered via secure channel or derived from user password
     */
    async initialize(masterKeyBase64) {
        try {
            // Decode base64 key
            const keyBytes = this.base64ToArrayBuffer(masterKeyBase64);
            
            // Import as raw key material
            this.masterKey = await crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'PBKDF2' },
                false,
                ['deriveBits', 'deriveKey']
            );
            
            return true;
        } catch (error) {
            console.error('Failed to initialize decryption:', error);
            return false;
        }
    }

    /**
     * Derive field-specific key using PBKDF2 (matching server implementation)
     */
    async deriveKey(fieldName) {
        const cacheKey = fieldName;
        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey);
        }

        try {
            // Convert salt to ArrayBuffer
            const saltBuffer = new TextEncoder().encode(this.salt);
            
            // Derive bits using PBKDF2
            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                this.masterKey,
                256
            );

            // Import derived bits as AES key
            const key = await crypto.subtle.importKey(
                'raw',
                derivedBits,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            this.keyCache.set(cacheKey, key);
            return key;
        } catch (error) {
            console.error(`Key derivation failed for ${fieldName}:`, error);
            throw error;
        }
    }

    /**
     * Decrypt a single encrypted field
     */
    async decryptField(encryptedPayload) {
        if (!encryptedPayload || !encryptedPayload.e) {
            // Not encrypted, return as-is
            return encryptedPayload?.value || encryptedPayload;
        }

        try {
            const { v: ciphertextB64, i: ivB64, t: tagB64, f: fieldName } = encryptedPayload;

            // Decode base64 components
            const ciphertext = this.base64ToArrayBuffer(ciphertextB64);
            const iv = this.base64ToArrayBuffer(ivB64);
            const tag = this.base64ToArrayBuffer(tagB64);

            // Combine ciphertext + tag (server sends them separately, but AES-GCM expects together)
            const encryptedData = this.concatArrayBuffers(ciphertext, tag);

            // Derive field-specific key
            const key = await this.deriveKey(fieldName);

            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: 128
                },
                key,
                encryptedData
            );

            // Decode to string
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return '[decryption_failed]';
        }
    }

    /**
     * Recursively decrypt response data object
     */
    async decryptResponse(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const decrypted = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object') {
                if (value.e === true) {
                    // This is an encrypted field
                    decrypted[key] = await this.decryptField(value);
                } else if (key === 'login_urls' && typeof value === 'object') {
                    // Special handling for login_urls object
                    decrypted[key] = {};
                    for (const [urlKey, urlValue] of Object.entries(value)) {
                        if (urlValue && urlValue.e === true) {
                            decrypted[key][urlKey] = await this.decryptField(urlValue);
                        } else {
                            decrypted[key][urlKey] = urlValue;
                        }
                    }
                } else {
                    // Recursively decrypt nested objects
                    decrypted[key] = await this.decryptResponse(value);
                }
            } else {
                decrypted[key] = value;
            }
        }

        return decrypted;
    }

    /**
     * Process full API response
     */
    async processResponse(apiResponse) {
        if (!apiResponse || !apiResponse.encrypted) {
            // Not encrypted, return as-is
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
            throw new Error('Decryption failed: ' + error.message);
        }
    }

    // Utility functions
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    concatArrayBuffers(buffer1, buffer2) {
        const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }

    /**
     * Clear key cache (call on logout)
     */
    clearCache() {
        this.keyCache.clear();
        this.masterKey = null;
    }
}

// Global instance
const apiCrypto = new APIDecryption();

// Export for use in other modules
window.apiCrypto = apiCrypto;
