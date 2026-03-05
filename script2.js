// Test API
const API_URL = "https://hadowken-api.vercel.app";

async function testAPI() {
    try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();
        console.log("API Health:", data);
        alert("API is working! Check console.");
    } catch (e) {
        console.error("API Error:", e);
        alert("API Error: " + e.message);
    }
}

// Call this on page load or button click
testAPI();
