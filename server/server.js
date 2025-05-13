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
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Enable compatibility with both Socket.IO v2 and v3 clients
  maxHttpBufferSize: 1e8 // 100MB max buffer size for large payloads
});

// Add CORS middleware with expanded options
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(bodyParser.json());

const DATA_FILE = path.join(__dirname, 'data.json');

console.log(`Data file path: ${DATA_FILE}`);

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  console.log(`Data file not found, creating default data file: ${DATA_FILE}`);
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
    console.error('Error reading data file:', error);
    return { activities: [], shouldReset: false };
  }
};

io.on('connection', (socket) => {
  activeConnections++;
  console.log(`New client connected: ${socket.id} (Total: ${activeConnections})`);
  
  // Send the latest activities to the new client
  const initialData = getLatestActivitiesData();
  socket.emit('initial-data', initialData);
  
  // Handle explicit request for initial data
  socket.on('request-initial-data', () => {
    console.log(`Client ${socket.id} requested initial data`);
    const data = getLatestActivitiesData();
    socket.emit('initial-data', data);
  });
  
  // Let all clients know about the new connection
  io.emit('connection-count', { count: activeConnections });
  
  socket.on('disconnect', () => {
    activeConnections--;
    console.log(`Client disconnected: ${socket.id} (Total: ${activeConnections})`);
    io.emit('connection-count', { count: activeConnections });
  });
});

// Add middleware to log all Socket.IO events for debugging
io.use((socket, next) => {
  const clientId = socket.handshake.query.clientId || 'unknown';
  console.log(`Client connecting: ${clientId} (${socket.id})`);
  
  // Add additional properties to socket for tracking
  socket.clientInfo = {
    clientId,
    connectTime: new Date().toISOString(),
    userAgent: socket.handshake.headers['user-agent'] || 'unknown'
  };
  
  next();
});

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
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  const shouldReset = needsReset(data.activities);
  res.json({ activities: data.activities, shouldReset });
});

// Update activity completion status
app.put('/api/activities/:id', (req, res) => {
  const activityId = parseInt(req.params.id);
  console.log(`Received update request for activity ${activityId}:`, req.body);
  console.log(`Request from: ${req.ip}, User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
  
  if (isNaN(activityId)) {
    return res.status(400).json({ message: 'Invalid activity ID' });
  }
  
  try {
    // Read the latest data
    let data;
    try {
      const fileContents = fs.readFileSync(DATA_FILE);
      data = JSON.parse(fileContents);
    } catch (readError) {
      console.error('Error reading data file:', readError);
      return res.status(500).json({ message: 'Error reading data file' });
    }
    
    // Find the activity
    const activity = data.activities.find(a => a.id === activityId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    
    // Update the activity
    let updated = false;
    
    if (activity.type === 'counter' && typeof req.body.count !== 'undefined') {
      const newCount = parseInt(req.body.count);
      if (isNaN(newCount) || newCount < 0) {
        return res.status(400).json({ message: 'Invalid count value' });
      }
      
      activity.count = newCount;
      activity.completed = newCount > 0;
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
    
    // Save the data
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (writeError) {
      console.error('Error writing to data file:', writeError);
      return res.status(500).json({ message: 'Error writing to data file' });
    }
    
    // Broadcast the update
    console.log(`Broadcasting activity update: ID ${activity.id}, completed=${activity.completed}`);
    
    const updatePayload = { 
      activities: data.activities,
      activityId: activity.id,
      timestamp: new Date().toISOString(),
      updatedBy: req.ip || 'unknown'
    };
    
    io.emit('activity-updated', updatePayload);
    console.log(`Activity update broadcast complete, active connections: ${activeConnections}`);
    
    // Return success
    res.status(200).json(activity);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ message: 'Server error updating activity' });
  }
});

// Reset all activities (for new day)
app.post('/api/reset', (req, res) => {
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    
    // Emit reset event to all connected clients
    console.log('Broadcasting activities reset to all clients');
    console.log(`Connected clients: ${activeConnections}`);
    io.emit('activities-reset', { 
      activities: data.activities,
      timestamp: new Date().toISOString(),
      resetBy: req.ip || 'unknown'
    });
    
    res.json({ message: 'Activities reset successfully' });
  } catch (error) {
    console.error('Error resetting activities:', error);
    res.status(500).json({ message: 'Server error resetting activities' });
  }
});

// Add a health check endpoint for monitoring
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
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
      console.log(`Server running on port ${port} in ${NODE_ENV} mode`);
      console.log(`CORS enabled for origin: ${CORS_ORIGIN}`);
      return;
    } catch (error) {
      console.error(`Port ${port} is not available, trying port ${port + 1}`);
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