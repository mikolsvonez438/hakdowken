// api/proxy.js - Vercel serverless function
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Build target URL - REMOVE /api/proxy from path
  const targetPath = req.url.replace(/^\/api\/proxy/, '');
  const targetUrl = `http://prem-eu3.bot-hosting.net:21582${targetPath}`;
  
  console.log('Proxying to:', targetUrl, 'Method:', req.method);

  try {
    // Prepare headers
    const headers = {};
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    // Handle body for POST/PUT/PATCH
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      // Check if body exists and has content
      if (req.body && (typeof req.body === 'object' && Object.keys(req.body).length > 0)) {
        // If Content-Type is JSON, stringify it
        if (headers['Content-Type']?.includes('application/json')) {
          fetchOptions.body = JSON.stringify(req.body);
        } else {
          fetchOptions.body = req.body;
        }
      }
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // Get response body
    const responseBody = await response.text();
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(responseBody);
      res.status(response.status).json(jsonData);
    } catch {
      res.status(response.status).send(responseBody);
    }
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({ 
      status: 'error',
      error: 'Bad Gateway', 
      message: error.message 
    });
  }
}

// Disable body parsing to handle raw body
export const config = {
  api: {
    bodyParser: true, // Enable for JSON parsing
  },
};
