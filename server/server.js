const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Environment configuration
const PORT = process.env.PORT || 5001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const app = express();

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:");
  next();
});

// Input validation middleware
const validateActivityId = (req, res, next) => {
  const activityId = parseInt(req.params.id);
  if (!activityId || activityId < 1 || activityId > 999999) {
    return res.status(400).json({ message: 'Invalid activity ID' });
  }
  req.validatedActivityId = activityId;
  next();
};

const validateActivityUpdate = (req, res, next) => {
  const { completed, count } = req.body;
  
  if (typeof completed !== 'undefined' && typeof completed !== 'boolean') {
    return res.status(400).json({ message: 'Completed must be a boolean' });
  }
  
  if (typeof count !== 'undefined') {
    const numCount = parseInt(count);
    if (isNaN(numCount) || numCount < 0 || numCount > 100) {
      return res.status(400).json({ message: 'Count must be a number between 0 and 100' });
    }
    req.body.count = numCount;
  }
  
  next();
};

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  maxHttpBufferSize: 1e6 // Reduced to 1MB
});

// Add CORS middleware with restricted origins
app.use(cors({
  origin: CORS_ORIGIN.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(bodyParser.json({ limit: '1mb' }));

const DATA_FILE = path.join(__dirname, 'data.json');

// File locking mechanism
const fileLocks = new Map();

const acquireFileLock = async (filePath) => {
  return new Promise((resolve) => {
    const waitForLock = () => {
      if (!fileLocks.has(filePath)) {
        fileLocks.set(filePath, true);
        resolve();
      } else {
        setTimeout(waitForLock, 10);
      }
    };
    waitForLock();
  });
};

const releaseFileLock = (filePath) => {
  fileLocks.delete(filePath);
};

// Atomic file write function
const writeDataFile = async (data) => {
  await acquireFileLock(DATA_FILE);
  try {
    const tempFile = DATA_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, DATA_FILE);
  } finally {
    releaseFileLock(DATA_FILE);
  }
};

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  const initialData = {
    activities: [
      { id: 1, name: "Spanish Practice", points: 5, description: "Complete 1 lesson in Studycat on the iPad, or some equivalent activity approved by a parent.", completed: false, completedAt: null },
      { id: 2, name: "Typing Practice", points: 5, description: "Complete 1 lesson in Typing Land on the iPad, or some equivalent activity approved by a parent.", completed: false, completedAt: null },
      { id: 3, name: "Aesop's Fables", points: 10, description: "Read one Aesop's Fable and then complete the reflection page. First, summarize the story in your own words. Then, answer the questions about the moral and how it applies to your life today.", completed: false, completedAt: null },
      { id: 4, name: "Khan Academy Math", points: 15, description: "Complete assigned math exercises", completed: false, completedAt: null },
      { id: 5, name: "Spelling Workbook", points: 15, description: "Complete one page in spelling workbook", completed: false, completedAt: null },
      { id: 6, name: "Extra Math Page", points: 5, description: "Complete an additional math page. If you don't have one available, ask a parent to generate a new one. You can complete this multiple times per day for additional points.", completed: false, completedAt: null, count: 0, type: "counter" },
      { id: 7, name: "Extra Spelling Page", points: 5, description: "Complete an additional spelling page. If you don't have one available, ask a parent to generate a new one. You can complete this multiple times per day for additional points.", completed: false, completedAt: null, count: 0, type: "counter" },
      { id: 8, name: "Word Hunter Challenge", points: 10, description: "While you're reading (Aesop's, comics, etc), find 5 words you don't know. For each word, grab your pocket dictionary and look it up. Then, either tell us what it means (from memory), or write the meaning in your own words.", completed: false, completedAt: null },
      { id: 9, name: "Logic Workbook", points: 5, description: "Complete 1 activity from your logic workbook. You can complete this multiple times per day for additional points.", completed: false, completedAt: null, count: 0, type: "counter" }
    ]
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

// Socket.IO connection handling
let activeConnections = 0;

// Helper function to get the latest activities data
const getLatestActivitiesData = () => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    const shouldReset = needsReset(data.activities);
    return { activities: data.activities, shouldReset };
  } catch (error) {
    if (NODE_ENV !== 'production') {
      console.error('Error reading data file:', error);
    }
    return { activities: [], shouldReset: false };
  }
};

io.on('connection', (socket) => {
  activeConnections++;
  
  // Send the latest activities to the new client
  const initialData = getLatestActivitiesData();
  socket.emit('initial-data', initialData);
  
  // Handle explicit request for initial data
  socket.on('request-initial-data', () => {
    const data = getLatestActivitiesData();
    socket.emit('initial-data', data);
  });
  
  // Let all clients know about the new connection (removed sensitive info)
  io.emit('connection-count', { count: activeConnections });
  
  socket.on('disconnect', () => {
    activeConnections--;
    io.emit('connection-count', { count: activeConnections });
  });
});

// Removed detailed client tracking for security

// Helper function to check if activities need reset
const needsReset = (activities) => {
  const today = new Date().toDateString();
  return activities.some(activity => 
    activity.completed && 
    activity.completedAt && 
    new Date(activity.completedAt).toDateString() !== today
  );
};

// Get all activities
app.get('/api/activities', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    const shouldReset = needsReset(data.activities);
    res.json({ activities: data.activities, shouldReset });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update activity completion status
app.put('/api/activities/:id', validateActivityId, validateActivityUpdate, async (req, res) => {
  const activityId = req.validatedActivityId;
  
  try {
    // Read the latest data
    let data;
    try {
      const fileContents = fs.readFileSync(DATA_FILE);
      data = JSON.parse(fileContents);
    } catch (readError) {
      return res.status(500).json({ message: 'Server error' });
    }
    
    // Find the activity
    const activity = data.activities.find(a => a.id === activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    
    // Update the activity
    let updated = false;
    
    if (activity.type === 'counter' && typeof req.body.count !== 'undefined') {
      activity.count = req.body.count;
      activity.completed = req.body.count > 0;
      activity.completedAt = activity.completed ? new Date().toISOString() : null;
      updated = true;
    } else if (typeof req.body.completed !== 'undefined') {
      activity.completed = !!req.body.completed;
      activity.completedAt = activity.completed ? new Date().toISOString() : null;
      updated = true;
    }
    
    if (!updated) {
      return res.status(400).json({ message: 'No valid update parameters provided' });
    }
    
    // Save the data atomically
    try {
      await writeDataFile(data);
    } catch (writeError) {
      return res.status(500).json({ message: 'Server error' });
    }
    
    // Broadcast the update (removed sensitive information)
    const updatePayload = { 
      activities: data.activities,
      activityId: activity.id,
      timestamp: new Date().toISOString()
    };
    
    io.emit('activity-updated', updatePayload);
    
    // Return success
    res.status(200).json(activity);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset all activities (for new day)
app.post('/api/reset', async (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE));
    data.activities.forEach(activity => {
      activity.completed = false;
      activity.completedAt = null;
      
      // Reset count for counter-type activities
      if (activity.type === 'counter') {
        activity.count = 0;
      }
    });
    
    await writeDataFile(data);
    
    // Emit reset event to all connected clients (removed sensitive info)
    io.emit('activities-reset', { 
      activities: data.activities,
      timestamp: new Date().toISOString()
    });
    
    res.json({ message: 'Activities reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a health check endpoint for monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Serve static files from the React app in production
if (NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  
  app.use(express.static(clientBuildPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Try to find an available port
const startServer = (initialPort) => {
  let port = initialPort;
  const maxPortAttempts = 10;
  
  for (let attempt = 0; attempt < maxPortAttempts; attempt++) {
    try {
      server.listen(port);
      if (NODE_ENV !== 'production') {
        console.log(`Server running on port ${port} in ${NODE_ENV} mode`);
        console.log(`CORS enabled for origin: ${CORS_ORIGIN}`);
      }
      return;
    } catch (error) {
      port += 1;
    }
  }
  
  console.error(`Failed to find an available port after ${maxPortAttempts} attempts`);
  process.exit(1);
};

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

// Start the server
startServer(PORT); 