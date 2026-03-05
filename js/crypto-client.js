/**
 * Client-side decryption for PyCryptodome AES-256-CBC
 */

class APIDecryption {
    constructor() {
        this.keyCache = new Map();
        this.masterKey = null;
        this.salt = 'netflix_checker_salt_v1';
    }

    async initialize(masterKeyBase64) {
        try {
            // Fix padding
            let key = masterKeyBase64.replace(/=/g, '');
            const padLen = (4 - key.length % 4) % 4;
            key += '='.repeat(padLen);
            
            const keyBytes = this.base64ToArrayBuffer(key);
            this.masterKey = new Uint8Array(keyBytes);
            console.log('Crypto initialized, key length:', this.masterKey.length);
            return true;
        } catch (error) {
            console.error('Crypto init failed:', error);
            return false;
        }
    }

    async deriveKey(fieldName) {
        if (this.keyCache.has(fieldName)) {
            return this.keyCache.get(fieldName);
        }

        try {
            const encoder = new TextEncoder();
            const fieldBytes = encoder.encode(fieldName);
            
            // Combine master key + field name
            const combined = new Uint8Array(this.masterKey.length + fieldBytes.length);
            combined.set(this.masterKey);
            combined.set(fieldBytes, this.masterKey.length);

            const baseKey = await crypto.subtle.importKey(
                'raw',
                combined,
                { name: 'PBKDF2' },
                false,
                ['deriveBits']
            );

            const derivedBits = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode(this.salt),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                baseKey,
                256
            );

            const aesKey = await crypto.subtle.importKey(
                'raw',
                derivedBits,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            );

            this.keyCache.set(fieldName, aesKey);
            return aesKey;
        } catch (error) {
            console.error('Key derivation failed:', error);
            throw error;
        }
    }

    async decryptField(encryptedObj) {
        if (!encryptedObj || encryptedObj.e !== true) {
            return encryptedObj?.value !== undefined ? encryptedObj.value : encryptedObj;
        }

        try {
            const { v, i, f } = encryptedObj;
            
            // Fix base64 padding
            let cipherB64 = v.replace(/=/g, '');
            let ivB64 = i.replace(/=/g, '');
            
            cipherB64 += '='.repeat((4 - cipherB64.length % 4) % 4);
            ivB64 += '='.repeat((4 - ivB64.length % 4) % 4);

            const ciphertext = this.base64ToArrayBuffer(cipherB64);
            const iv = this.base64ToArrayBuffer(ivB64);
            
            const key = await this.deriveKey(f);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv: new Uint8Array(iv) },
                key,
                ciphertext
            );

            // Remove PKCS7 padding
            const bytes = new Uint8Array(decrypted);
            const padLen = bytes[bytes.length - 1];
            const result = bytes.slice(0, bytes.length - padLen);
            
            return new TextDecoder().decode(result);
        } catch (error) {
            console.error('Decrypt field failed:', error, encryptedObj);
            return '[decrypt_error]';
        }
    }

    // RECURSIVE decryption for nested objects
    async decryptObject(obj) {
  // Handle null/undefined
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const result = [];
    for (const item of obj) {
      result.push(await this.decryptObject(item));
    }
    return result;
  }

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip metadata fields that aren't data containers
    if (key === 'e' || key === 'v' || key === 'i' || key === 't' || key === 'f') {
      continue;
    }

    if (value && typeof value === 'object') {
      // Check if this is an encrypted field (has e: true, v, i)
      if (value.e === true && value.v && value.i) {
        result[key] = await this.decryptField(value);
      } else {
        // Recurse into nested object
        result[key] = await this.decryptObject(value);
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

    async processResponse(apiResponse) {
  console.log('Processing response:', apiResponse);
  
  if (!apiResponse || apiResponse.encrypted !== true) {
    console.log('Response not encrypted, returning as-is');
    return apiResponse;
  }

  try {
    // Initialize if needed
    if (!this.masterKey) {
      const storedKey = localStorage.getItem('api_encryption_key');
      if (storedKey) {
        await this.initialize(storedKey);
      } else {
        throw new Error('No encryption key available');
      }
    }

    // Decrypt the data payload
    const decryptedData = await this.decryptObject(apiResponse.data);
    
    console.log('Decrypted data:', decryptedData);
    
    // Return full response structure with decrypted data
    return {
      ...apiResponse,
      data: decryptedData,
      decrypted: true,
      encrypted: false  // Mark as no longer encrypted
    };
    
  } catch (error) {
    console.error('Process response failed:', error);
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
