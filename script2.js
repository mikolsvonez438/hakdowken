const API_URL = "https://hadowken-api.vercel.app";

async function apiCall(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: options.method || "GET",
        headers: headers,
        body: options.body,
        credentials: "include",
    });

    if (response.status === 401) {
        alert("Session expired");
        return null;
    }

    return response.json();
}

// Test on load
async function testConnection() {
    const health = await apiCall('/api/health');
    console.log("Health:", health);
    
    const test = await apiCall('/api/test');
    console.log("Test:", test);
}

testConnection();
