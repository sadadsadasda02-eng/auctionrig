/**
 * Render.com Backend for Fragment Preview Images
 * Automatically uploads PNGs to GitHub repository
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set in Render dashboard
const GITHUB_OWNER = process.env.GITHUB_OWNER; // Your GitHub username
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g., 'fragment-previews'
const GITHUB_BRANCH = 'main';

// GitHub API helper
async function githubAPI(endpoint, method = 'GET', data = null) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}${endpoint}`;
  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  
  try {
    const response = await axios({ method, url, headers, data });
    return response.data;
  } catch (error) {
    console.error('GitHub API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Get current username → image number mappings
async function getMappings() {
  try {
    const file = await githubAPI('/contents/mappings.json');
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.response?.status === 404) {
      // File doesn't exist yet, return empty mappings
      return {};
    }
    throw error;
  }
}

// Upload file to GitHub
async function uploadToGitHub(filepath, content, message) {
  // Check if file exists (to get SHA for update)
  let sha = null;
  try {
    const existing = await githubAPI(`/contents/${filepath}`);
    sha = existing.sha;
  } catch (error) {
    // File doesn't exist, will create new
  }
  
  // Convert content to base64 if it's not already
  let base64Content = content;
  if (content.startsWith('data:image/png;base64,')) {
    base64Content = content.replace('data:image/png;base64,', '');
  } else if (!content.match(/^[A-Za-z0-9+/=]+$/)) {
    // Plain text content (like JSON)
    base64Content = Buffer.from(content).toString('base64');
  }
  
  const data = {
    message: message || `Update ${filepath}`,
    content: base64Content,
    branch: GITHUB_BRANCH,
  };
  
  if (sha) {
    data.sha = sha; // Required for updates
  }
  
  return await githubAPI(`/contents/${filepath}`, 'PUT', data);
}

// API Routes

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Fragment Preview Backend',
    github: `${GITHUB_OWNER}/${GITHUB_REPO}`,
  });
});

// Upload new preview image
app.post('/api/upload-preview', async (req, res) => {
  try {
    const { username, imageData } = req.body;
    
    if (!username || !imageData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing username or imageData' 
      });
    }
    
    console.log(`[Upload] Received request for username: ${username}`);
    
    // 1. Get current mappings
    const mappings = await getMappings();
    
    // 2. Check if username already has an image number
    let imageNum = mappings[username];
    if (!imageNum) {
      // Assign new number
      const existingNumbers = Object.values(mappings);
      imageNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      console.log(`[Upload] Assigned new image number: ${imageNum}`);
    } else {
      console.log(`[Upload] Updating existing image: ${imageNum}`);
    }
    
    // 3. Upload PNG to GitHub
    await uploadToGitHub(
      `images/${imageNum}.png`,
      imageData,
      `Update preview for @${username} (image ${imageNum})`
    );
    
    // 4. Update mappings
    mappings[username] = imageNum;
    await uploadToGitHub(
      'mappings.json',
      JSON.stringify(mappings, null, 2),
      `Add mapping: ${username} → ${imageNum}`
    );
    
    // 5. Generate image URL
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/images/${imageNum}.png`;
    
    console.log(`[Upload] Success! Image URL: ${imageUrl}`);
    
    res.json({
      success: true,
      username,
      imageNum,
      imageUrl,
      message: `Preview uploaded successfully for @${username}`
    });
    
  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get preview image URL for username
app.get('/api/preview/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Get mappings
    const mappings = await getMappings();
    
    // Get image number (default to 1 if not found)
    const imageNum = mappings[username.toLowerCase()] || 1;
    
    // Generate image URL
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/images/${imageNum}.png`;
    
    res.json({
      username,
      imageNum,
      imageUrl
    });
    
  } catch (error) {
    console.error('[Preview] Error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Get all mappings (for debugging)
app.get('/api/mappings', async (req, res) => {
  try {
    const mappings = await getMappings();
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current username config
async function getCurrentUsername() {
  try {
    const file = await githubAPI('/contents/current-username.json');
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    const data = JSON.parse(content);
    return data.username || 'board';
  } catch (error) {
    if (error.response?.status === 404) {
      return 'board'; // Default
    }
    throw error;
  }
}

// Set current username (global username displayed on site)
app.post('/api/set-username', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing username' 
      });
    }
    
    console.log(`[Username] Setting current username to: ${username}`);
    
    // Save to GitHub
    const data = {
      username: username.toLowerCase(),
      updatedAt: new Date().toISOString(),
    };
    
    await uploadToGitHub(
      'current-username.json',
      JSON.stringify(data, null, 2),
      `Set current username to: ${username}`
    );
    
    console.log(`[Username] Success! Current username: ${username}`);
    
    res.json({
      success: true,
      username,
      message: `Current username set to: @${username}`
    });
    
  } catch (error) {
    console.error('[Username] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current username
app.get('/api/current-username', async (req, res) => {
  try {
    const username = await getCurrentUsername();
    
    res.json({
      username,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Username] Error:', error);
    res.status(500).json({
      error: error.message
    });
  }
});

// Save session/IP tracking
app.post('/api/save-session', async (req, res) => {
  try {
    const { username, ip, userAgent, timestamp } = req.body;
    
    console.log(`[Session] New visit: ${username} from ${ip}`);
    
    // Load existing sessions
    let sessions = [];
    try {
      const file = await githubAPI('/contents/sessions.json');
      const content = Buffer.from(file.content, 'base64').toString('utf8');
      sessions = JSON.parse(content);
    } catch (e) {
      // File doesn't exist yet
    }
    
    // Add new session
    sessions.push({
      username,
      ip,
      userAgent,
      timestamp: timestamp || new Date().toISOString()
    });
    
    // Keep only last 100 sessions
    if (sessions.length > 100) {
      sessions = sessions.slice(-100);
    }
    
    // Save to GitHub
    await uploadToGitHub(
      'sessions.json',
      JSON.stringify(sessions, null, 2),
      `Track session: ${username} from ${ip}`
    );
    
    res.json({
      success: true,
      message: 'Session tracked'
    });
    
  } catch (error) {
    console.error('[Session] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const file = await githubAPI('/contents/sessions.json');
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    const sessions = JSON.parse(content);
    
    res.json(sessions);
  } catch (error) {
    if (error.response?.status === 404) {
      res.json([]);
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📦 GitHub: ${GITHUB_OWNER}/${GITHUB_REPO}`);
});
