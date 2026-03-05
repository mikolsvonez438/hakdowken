// Initialize encryption on startup
async function initializeEncryption() {
    // Get encryption key from secure endpoint after login
    // Or derive from user session
    const key = localStorage.getItem('api_encryption_key');
    if (key) {
        await apiCrypto.initialize(key);
    }
}

// Modified API call function with automatic decryption
async function apiCall(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: options.method || "GET",
        headers: headers,
        body: options.body,
        credentials: "include",
        mode: "cors",
    });

    if (response.status === 401) {
        showNotification("Session expired. Please login again.", true);
        logout();
        return null;
    }

    const data = await response.json();
    
    // Auto-decrypt if encrypted
    if (data && data.encrypted) {
        try {
            // Ensure crypto is initialized
            if (!apiCrypto.masterKey) {
                const key = localStorage.getItem('api_encryption_key');
                if (key) await apiCrypto.initialize(key);
            }
            
            const decrypted = await apiCrypto.processResponse(data);
            return decrypted;
        } catch (e) {
            console.error('Decryption error:', e);
            showNotification('Failed to decrypt data', true);
            return data; // Return encrypted as fallback
        }
    }

    return data;
}

// Update handleAuth to fetch encryption key after login
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const submitBtn = document.getElementById("auth-submit");

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing...';

    try {
        const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data.status === "success") {
            if (isLoginMode) {
                accessToken = data.session.access_token;
                currentUser = data.user;
                isPremium = data.user.is_premium;
                
                localStorage.setItem("access_token", accessToken);
                localStorage.setItem("refresh_token", data.session.refresh_token);
                
                // Fetch and store encryption key
                await fetchEncryptionKey();
                
                updateUIForUser();
                hideAuthModal();
                showNotification("Login successful!");
            } else {
                showNotification("Account created! Please login.");
                toggleAuthMode();
            }
        } else {
            authError.textContent = data.message;
        }
    } catch (error) {
        authError.textContent = "Network error. Please try again.";
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> ${isLoginMode ? "Login" : "Sign Up"}`;
    }
}

// Fetch encryption key from server (protected endpoint)
async function fetchEncryptionKey() {
    try {
        const response = await fetch(`${API_URL}/api/auth/key`, {
            headers: { 
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            credentials: "include"
        });
        
        const data = await response.json();
        if (data.status === "success" && data.key) {
            localStorage.setItem('api_encryption_key', data.key);
            await apiCrypto.initialize(data.key);
        }
    } catch (e) {
        console.error('Failed to fetch encryption key:', e);
    }
}
