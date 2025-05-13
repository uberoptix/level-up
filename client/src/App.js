import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import ActivityCard from './components/ActivityCard';
import SafariActivityCard from './components/SafariActivityCard';
import IOSFallback from './components/iOSFallback'; 
import ActivityModal from './components/ActivityModal';
import './App.css';

// Modified API URL to work on all devices
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5001/api' 
  : `${window.location.protocol}//${window.location.hostname}:5001/api`;

// Socket.IO URL (same as API but without /api path)
const SOCKET_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5001' 
  : `${window.location.protocol}//${window.location.hostname}:5001`;

// For debugging - log socket configuration  
console.log('Socket.IO URL:', SOCKET_URL);

// Detect iOS Safari - improved detection
const isIOSSafari = () => {
  const ua = window.navigator.userAgent;
  const isIPad = !!ua.match(/iPad/i) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPhone = !!ua.match(/iPhone/i);
  const isIOS = isIPad || isIPhone;
  const webkit = !!ua.match(/WebKit/i);
  const isSafari = isIOS && webkit && !ua.match(/CriOS/i) && !ua.match(/FxiOS/i);
  
  // Logging for debugging
  console.log('Device detection:', {
    userAgent: ua,
    isIPad,
    isIPhone,
    isIOS,
    webkit,
    isSafari,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight
  });
  
  return isSafari;
};

function App() {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [useTableFallback, setUseTableFallback] = useState(false);
  const [usingStaticData, setUsingStaticData] = useState(false);
  const socketRef = useRef(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [connectedClients, setConnectedClients] = useState(1);
  const [debugMode, setDebugMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiredActivitiesCompleted, setRequiredActivitiesCompleted] = useState(false);
  const userInitiatedActions = useRef({});
  // Add ref for socketConnected to avoid ESLint warning
  const socketConnectedRef = useRef(false);
  const connectionNoticeShown = useRef(false);
  // Define additional state variable to track iOS notification needs
  const [forceIOSNotification, setForceIOSNotification] = useState(false);
  const [iosNotificationMessage, setIOSNotificationMessage] = useState('');
  const lastIOSNotificationTimeRef = useRef(0);
  // Keep track of real connected clients count to prevent cycling
  const stableConnectedClientsRef = useRef(1);
  const lastConnectionUpdateTime = useRef(Date.now());
  // Add state for reset confirmation modal
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  // iOS-specific notification function
  const showIOSNotification = useCallback((message) => {
    if (!isIOS) return;
    
    const now = Date.now();
    // Only show notification if 2+ seconds have passed since last one
    if (now - lastIOSNotificationTimeRef.current > 2000) {
      console.log('Forcing iOS notification:', message);
      setIOSNotificationMessage(message);
      setForceIOSNotification(true);
      lastIOSNotificationTimeRef.current = now;
      
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setForceIOSNotification(false);
      }, 4000);
    }
  }, [isIOS]);
  
  // Function to show a timed notification
  const displayNotification = useCallback((message) => {
    // For iOS, all notifications should go through showIOSNotification
    if (isIOS) {
      if (message.includes('updated by another device') || 
          message.includes('Connected to server') || 
          message.includes('Connection to server')) {
        showIOSNotification(message);
      }
      // Skip showing bottom notification for iOS
      return;
    }
    
    // For non-iOS devices, continue with normal notification
    // Skip all connection-related notifications if we already show connected devices banner
    if (connectedClients > 1 && 
        (message.includes('connected to server') || 
         message.includes('devices are now connected') ||
         message.includes('real-time updates') ||
         message.includes('Connection to server'))) {
      console.log('Skipping duplicate connection notification:', message);
      return;
    }
    
    setNotificationMessage(message);
    setShowNotification(true);
    
    // Hide notification after 4 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  }, [connectedClients, isIOS, showIOSNotification]);

  // Add keyboard listener for debug mode toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Press 'D' key to toggle debug mode
      if (e.key === 'd' || e.key === 'D') {
        setDebugMode(prev => !prev);
        console.log('Debug mode:', !debugMode);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [debugMode]);

  // Define calculateTotalPoints first with useCallback
  const calculateTotalPoints = useCallback((activities) => {
    const total = activities
      .reduce((sum, activity) => {
        if (activity.type === 'counter') {
          // For counter activities, multiply points by count
          return sum + (activity.points * (activity.count || 0));
        } else if (activity.completed) {
          // For regular activities, add points if completed
          return sum + activity.points;
        }
        return sum;
      }, 0);
    setTotalPoints(total);
    
    // Check if both Khan Academy Math and Spelling Workbook are completed
    const khanCompleted = activities.find(a => a.name.includes("Khan Academy Math"))?.completed || false;
    const spellingCompleted = activities.find(a => a.name.includes("Spelling Workbook"))?.completed || false;
    setRequiredActivitiesCompleted(khanCompleted && spellingCompleted);
  }, []);

  // Now define fetchActivities with useCallback
  const fetchActivities = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/activities`, { timeout: 5000 });
      const activitiesArr = Array.isArray(response.data.activities) ? response.data.activities : [];
      
      if (activitiesArr.length > 0) {
        setUsingStaticData(false);
        setActivities(activitiesArr);
        calculateTotalPoints(activitiesArr);
        if (response.data.shouldReset) {
          setShowResetPrompt(true);
        }
      } else {
        // If response is empty but successful, still clear the connection error state
        setUsingStaticData(false);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      // Show connection error state but keep any existing activities
      setUsingStaticData(true);
      displayNotification('Connection to server failed - updates will not sync');
    } finally {
      setIsLoading(false);
    }
  }, [calculateTotalPoints, displayNotification, setShowResetPrompt]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Set iOS detection on mount
    const isiOS = isIOSSafari();
    setIsIOS(isiOS);
    // Default to fallback on iOS
    setUseTableFallback(isiOS);
    
    // We'll get activities from the WebSocket initial data or fall back to HTTP
    let initialDataReceived = false;
    socketConnectedRef.current = false;
    let httpRequestSent = false;

    // Force cleanup of any previous socket connections
    if (socketRef.current) {
      console.log('Disconnecting existing socket before reconnecting');
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Determine correct Socket.IO URL - always use explicit port for mobile
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5001'
      : `${window.location.protocol}//${window.location.hostname}:5001`;
      
    console.log('Initializing Socket.IO connection to:', socketUrl);
    
    // Create Socket.IO instance with reliable configuration
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 30000,
      autoConnect: true,
      forceNew: true,
      path: '/socket.io'
    });

    // Start HTTP request after 2 seconds if socket hasn't delivered data
    const fetchActivitiesWithDelay = () => {
      setTimeout(() => {
        if (!initialDataReceived && !httpRequestSent) {
          console.log('Socket connection delay, trying HTTP fallback');
          httpRequestSent = true;
          fetchActivities();
        }
      }, 2000);
    };
    
    // Start the fallback timer
    fetchActivitiesWithDelay();

    // Socket events
    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server with ID:', socketRef.current.id);
      socketConnectedRef.current = true;
      
      // Clear static data mode when socket successfully connects
      if (usingStaticData) {
        setUsingStaticData(false);
        if (!isIOS) {
          displayNotification('Connected to server - changes will now sync');
        }
      }
      // Show notification for iOS in the same top position only
      if (isIOS) {
        showIOSNotification('Connected to server - changes will update in real-time');
      }
      
      // Notify the server we need data right away
      socketRef.current.emit('request-initial-data');
    });

    // Receive initial data when connecting
    socketRef.current.on('initial-data', (data) => {
      console.log('Received initial data via WebSocket:', data);
      initialDataReceived = true;
      
      if (data.activities && data.activities.length > 0) {
        // Since we received data from the server, we're not in static mode
        setUsingStaticData(false);
        setActivities(data.activities);
        calculateTotalPoints(data.activities);
        if (data.shouldReset) {
          setShowResetPrompt(true);
        }
      }
      
      // Data has been loaded, whether empty or not
      setIsLoading(false);
    });

    socketRef.current.on('activity-updated', (data) => {
      console.log('Activity updated via WebSocket:', data);
      
      try {
        // Get the ID of the updated activity
        const updatedId = data.activityId;
        
        // Check if this update was initiated by the current client
        const isUserAction = updatedId && userInitiatedActions.current.hasOwnProperty(updatedId);
        
        console.log('Update details:', { 
          updatedId, 
          userAction: isUserAction,
          userActions: JSON.stringify(userInitiatedActions.current)
        });
        
        // Check for valid activities array to prevent errors
        if (!data.activities || !Array.isArray(data.activities)) {
          console.error('Received invalid activities data:', data);
          return;
        }
        
        // Important: Always update with the latest data from the server
        console.log(`Updating activities from server data (${data.activities.length} items)`);
        
        // If we received an update, we're clearly not in static data mode
        if (usingStaticData) {
          setUsingStaticData(false);
          displayNotification('Connected to server - changes will now sync');
        }
        
        // Always update state with server data, regardless of source
        setActivities(data.activities);
        calculateTotalPoints(data.activities);
        
        // Only show notification if this is not a user-initiated update
        if (!isUserAction) {
          // Only show notification if significant time has passed since last one
          const now = new Date().getTime();
          const lastNotificationTime = userInitiatedActions.current.lastNotificationTime || 0;
          
          if (now - lastNotificationTime > 3000) { // Reduced from 5000ms to 3000ms for faster notifications
            // Show notification that activities were updated
            displayNotification('Activities have been updated by another device');
            userInitiatedActions.current.lastNotificationTime = now;
            
            // Focus on using our dedicated notification system for iOS - no alerts
            if (isIOS) {
              showIOSNotification('Activities have been updated by another device');
            }
          } else {
            console.log('Suppressing frequent update notification');
          }
          
          // Close any open activity modal to prevent conflicts
          setSelectedActivity(null);
        } else {
          // Clear the action from our tracking object
          delete userInitiatedActions.current[updatedId];
          console.log('Cleared user action for ID:', updatedId);
        }
        
        // Ensure loading is complete
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing activity update:', error);
      }
    });

    socketRef.current.on('activities-reset', (data) => {
      console.log('Activities reset via WebSocket:', data);
      if (data.activities) {
        // We received data from the server, so we're not in static mode
        setUsingStaticData(false);
        setActivities(data.activities);
        calculateTotalPoints(data.activities);
        setShowResetPrompt(false);
        
        // Show notification that activities were reset
        displayNotification('Activities have been reset for a new day');
        
        // Close any open activity modal to prevent conflicts
        setSelectedActivity(null);
      }
    });

    socketRef.current.on('connection-count', (data) => {
      console.log('Connected clients:', data.count);
      
      // Implement more stable connection count logic
      // Only update if the count is different and not temporarily fluctuating
      const newCount = data.count;
      
      // For iOS devices, prevent rapid fluctuation in connected count
      if (isIOS) {
        // Only update if the count is stable for 2+ seconds or differs by more than 1
        if (Math.abs(newCount - stableConnectedClientsRef.current) > 1 || 
            (newCount !== connectedClients && Date.now() - lastConnectionUpdateTime.current > 2000)) {
          
          console.log(`Updating connection count: ${connectedClients} -> ${newCount}`);
          stableConnectedClientsRef.current = newCount;
          lastConnectionUpdateTime.current = Date.now();
          setConnectedClients(newCount);
        } else {
          console.log(`Ignoring unstable connection count update: ${newCount}`);
        }
      } else {
        // For non-iOS devices, update immediately
        setConnectedClients(newCount);
      }
    });

    // Socket error handling
    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      if (!initialDataReceived && !httpRequestSent) {
        console.log('Socket connection error, trying HTTP');
        httpRequestSent = true;
        fetchActivities();
      }
    });
    
    socketRef.current.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      socketConnectedRef.current = false;
    });

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        console.log('Disconnecting Socket.IO');
        socketRef.current.disconnect();
      }
    };
  }, [fetchActivities, usingStaticData, activities.length, calculateTotalPoints, displayNotification]); // Added displayNotification

  // Listen for connection status changes
  useEffect(() => {
    // Only show notification when connections change in a meaningful way
    if (connectedClients === 0) {
      if (isIOS) {
        showIOSNotification('Disconnected from server. Updates will not sync in real-time.');
      } else {
        displayNotification('Disconnected from server. Updates will not sync in real-time.');
      }
    } else if (connectedClients === 1 && !connectionNoticeShown.current) {
      // Only first connection shows notification once
      if (isIOS) {
        showIOSNotification('Connected to server - changes will update in real-time');
      } else {
        displayNotification('Connected to server. All updates will sync in real-time.');
      }
      connectionNoticeShown.current = true;
    }
  }, [connectedClients, displayNotification, isIOS, showIOSNotification]);

  const handleActivityClick = (activity) => {
    setSelectedActivity(activity);
  };

  const handleCloseModal = () => {
    setSelectedActivity(null);
  };

  const handleActivityUpdate = async (activityId, completed, count) => {
    console.log(`Starting direct update for ID=${activityId}, completed=${completed}, count=${count || 'N/A'}`);
    
    // Get the activity details
    const currentActivity = activities.find(a => a.id === activityId);
    if (!currentActivity) {
      console.error(`Activity with ID ${activityId} not found`);
      return;
    }
    
    const isCounterType = currentActivity && currentActivity.type === 'counter';
    
    // Generate a unique timestamp for this update
    const updateTimestamp = new Date().getTime();
    
    // Create updated activity object
    let updatedActivity;
    if (isCounterType) {
      updatedActivity = {
        ...currentActivity,
        count: count,
        completed: count > 0,
        completedAt: count > 0 ? new Date().toISOString() : null
      };
    } else {
      updatedActivity = {
        ...currentActivity,
        completed: completed,
        completedAt: completed ? new Date().toISOString() : null
      };
    }
    
    // Close the modal immediately for most activities except counters
    if (!isCounterType || count === undefined) {
      setSelectedActivity(null);
    }
    
    // Create the update payload now - before updating UI
    const updatePayload = isCounterType ? { count } : { completed };
    
    // Track this update as user-initiated
    userInitiatedActions.current[activityId] = updateTimestamp;
    console.log(`User initiated update for activity ${activityId} with timestamp ${updateTimestamp}`);
    
    // Update the UI immediately
    const updatedActivities = activities.map(activity => 
      activity.id === activityId ? updatedActivity : activity
    );
    setActivities(updatedActivities);
    calculateTotalPoints(updatedActivities);
    
    // Add visual feedback
    setTimeout(() => {
      const cards = document.querySelectorAll(`[data-activity-id="${activityId}"]`);
      cards.forEach(card => {
        card.classList.add('state-changed');
        setTimeout(() => card.classList.remove('state-changed'), 50);
      });
    }, 50);
    
    // If we're in offline mode, show warning and return
    if (usingStaticData) {
      displayNotification('Warning: Changes not saved to server');
      return;
    }
    
    // Now send to server
    try {
      console.log(`Sending to server: ${JSON.stringify(updatePayload)}`);
      
      // Use our reliable cross-device update function
      const responseData = await sendActivityUpdateToServer(activityId, updatePayload);
      console.log('Server response:', responseData);
      
      // Clean up the tracked action after 5 seconds if not already cleared
      setTimeout(() => {
        if (userInitiatedActions.current[activityId] === updateTimestamp) {
          console.log(`Cleaning up stale user action for activity ${activityId}`);
          delete userInitiatedActions.current[activityId];
        }
      }, 5000);
    } catch (error) {
      console.error('Error updating activity:', error);
      
      // Clean up the user action entry
      delete userInitiatedActions.current[activityId];
      
      // Mark as using static data if there's an error
      setUsingStaticData(true);
      displayNotification('Error connecting to server - changes may not be saved');
    }
  };

  const handleReset = () => {
    // Show confirmation dialog before resetting
    setShowResetConfirmation(true);
  };

  const confirmReset = async () => {
    // Hide confirmation dialog
    setShowResetConfirmation(false);

    if (usingStaticData) {
      // We're in offline mode due to connection issue
      // Still update the UI locally, but warn the user
      const resetActivities = activities.map(activity => {
        const resetActivity = {
          ...activity,
          completed: false,
          completedAt: null
        };
        
        // Reset count for counter activities
        if (activity.type === 'counter') {
          resetActivity.count = 0;
        }
        
        return resetActivity;
      });
      setActivities(resetActivities);
      calculateTotalPoints(resetActivities);
      setShowResetPrompt(false);
      displayNotification('Warning: Reset not saved to server');
      return;
    }

    try {
      // Reset locally first for immediate feedback
      const resetActivities = activities.map(activity => {
        const resetActivity = {
          ...activity,
          completed: false,
          completedAt: null
        };
        
        // Reset count for counter activities
        if (activity.type === 'counter') {
          resetActivity.count = 0;
        }
        
        return resetActivity;
      });
      
      // Update the UI immediately
      setActivities(resetActivities);
      calculateTotalPoints(resetActivities);
      setShowResetPrompt(false);
      
      // Then send to server (the response will come via WebSocket)
      await axios.post(`${API_URL}/reset`);
      console.log('Reset request sent to server');
    } catch (error) {
      console.error('Error resetting activities:', error);
      
      // If there's an error with the server, keep using the local update
      // but mark that we're using static data
      setUsingStaticData(true);
      displayNotification('Error connecting to server - reset may not be saved');
    }
  };

  // Helper function to determine score color status
  const getScoreStatus = () => {
    const khanCompleted = activities.find(a => a.name.includes("Khan Academy Math"))?.completed || false;
    const spellingCompleted = activities.find(a => a.name.includes("Spelling Workbook"))?.completed || false;
    
    if (totalPoints >= 30 && khanCompleted && spellingCompleted) {
      return "success"; // Green - 30+ points with both required activities done
    } else if (totalPoints >= 30) {
      return "warning"; // Yellow - 30+ points but missing required activities
    } else {
      return "danger"; // Red - less than 30 points
    }
  };

  // Force activity cards into an array of rows for iOS Safari
  const activityRows = [];
  for (let i = 0; i < activities.length; i += 2) {
    activityRows.push(activities.slice(i, i + 2));
  }

  const renderActivities = () => {
    // Show loading state while activities are loading
    if (isLoading) {
      return (
        <div style={{ 
          padding: '40px 20px', 
          textAlign: 'center', 
          color: 'white',
          fontFamily: 'Share Tech Mono, monospace'
        }}>
          <div style={{
            fontSize: '1.4rem',
            marginBottom: '20px'
          }}>
            Loading activities...
          </div>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid rgba(0, 234, 255, 0.3)',
            borderRadius: '50%',
            borderTop: '5px solid #00eaff',
            margin: '0 auto',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      );
    }
    
    // If we have no activities but we're not loading, show a message
    if (!activities || activities.length === 0) {
      return (
        <div style={{ 
          padding: '40px 20px', 
          textAlign: 'center', 
          color: 'white',
          fontFamily: 'Share Tech Mono, monospace'
        }}>
          <div style={{
            fontSize: '1.4rem',
            marginBottom: '20px'
          }}>
            No activities found
          </div>
          <div style={{
            fontSize: '1rem',
            color: '#b6b6b6',
            marginTop: '16px'
          }}>
            There might be a connection issue, or no activities have been set up yet.
          </div>
          <button 
            onClick={fetchActivities} 
            style={{
              marginTop: '24px',
              padding: '10px 20px',
              background: '#00eaff',
              color: '#1a2233',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '1rem'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    if (useTableFallback) {
      // iOS Fallback with grid layout
      return <IOSFallback 
        activities={activities} 
        onActivityClick={handleActivityClick} 
        isLoading={isLoading} 
      />;
    } else if (isIOS) {
      // iOS Safari layout with grid of SafariActivityCard
      return (
        <div className="safari-container">
          {activities.map(activity => (
            <SafariActivityCard
              key={activity.id}
              activity={activity}
              onClick={() => handleActivityClick(activity)}
            />
          ))}
        </div>
      );
    } else {
      // Standard layout for other browsers
      return (
        <div className="activity-container">
          {activityRows.map((row, rowIndex) => (
            <div className="activity-row" key={`row-${rowIndex}`}>
              {row.map(activity => (
                <div className="activity-wrapper" key={activity.id}>
                  <ActivityCard
                    activity={activity}
                    onClick={() => handleActivityClick(activity)}
                    className="grid-item"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
  };

  // Helper function to reliably update activities from any device
  const sendActivityUpdateToServer = async (activityId, payload) => {
    console.log(`Sending update for activity ${activityId} using multiple methods`);
    
    // Use both fetch and XMLHttpRequest for maximum compatibility
    const url = `${API_URL}/activities/${activityId}`;
    
    try {
      // Method 1: Fetch API
      try {
        console.log(`Attempting fetch to ${url}`);
        const fetchResponse = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'omit',
          body: JSON.stringify(payload)
        });
        
        if (fetchResponse.ok) {
          console.log('Fetch successful!');
          return await fetchResponse.json();
        } else {
          console.log(`Fetch failed with status ${fetchResponse.status}, trying XMLHttpRequest`);
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
      }
      
      // Method 2: XMLHttpRequest (fallback for older devices)
      return new Promise((resolve, reject) => {
        console.log('Attempting XMLHttpRequest fallback');
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Cache-Control', 'no-cache');
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('XMLHttpRequest successful!');
            resolve(JSON.parse(xhr.responseText));
          } else {
            console.log(`XMLHttpRequest failed with status ${xhr.status}`);
            reject(new Error(`Server returned ${xhr.status}`));
          }
        };
        xhr.onerror = function() {
          console.error('XMLHttpRequest network error');
          reject(new Error('Network error'));
        };
        xhr.send(JSON.stringify(payload));
      });
    } catch (error) {
      console.error('All update methods failed:', error);
      throw error;
    }
  };

  // Super direct approach for iOS updates using a polling mechanism
  useEffect(() => {
    // Only run this for iOS devices
    if (!isIOS) return;
    
    console.log('Setting up iOS activity update polling');
    
    // Keep track of activities state for comparison
    let previousActivitiesJSON = JSON.stringify(activities);
    
    // Check for updates every 3 seconds
    const intervalId = setInterval(() => {
      const currentActivitiesJSON = JSON.stringify(activities);
      
      // If activities changed and it wasn't a user action, show notification
      if (previousActivitiesJSON !== currentActivitiesJSON && 
          Object.keys(userInitiatedActions.current).length === 0) {
        
        console.log('iOS polling detected activity change');
        showIOSNotification('Activities have been updated by another device');
      }
      
      previousActivitiesJSON = currentActivitiesJSON;
    }, 3000);
    
    return () => clearInterval(intervalId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIOS, activities, showIOSNotification]);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Level Up!</h1>
        <div className="scoreboard-header">
          <button 
            className="icon-button info-icon" 
            onClick={() => setShowInfoModal(true)}
            aria-label="What is Level Up?"
          >
            ?
          </button>
          <div className="scoreboard-title">DAILY SCOREBOARD</div>
          <button 
            className="icon-button reset-icon" 
            onClick={handleReset}
            aria-label="Reset for New Day"
          >
            ↻
          </button>
        </div>
        <div className="scoreboard-container">
          <div className={`daily-score-line score-status-${getScoreStatus()}`}>
            <span className="score-text">calstreamrr</span>
            <span className="score-value">
              {String(totalPoints).padStart(2, '0')}
              {totalPoints >= 30 && requiredActivitiesCompleted && <span style={{ fontSize: '0.8em', marginLeft: '3px' }}>⭐</span>}
            </span>
          </div>
        </div>
      </header>
      
      {usingStaticData && (
        <div style={{ 
          textAlign: 'center', 
          background: '#ff3860', 
          color: 'white',
          padding: '8px',
          margin: '0 auto 15px auto',
          maxWidth: '600px',
          borderRadius: '5px',
          fontSize: '0.9rem',
          boxShadow: '0 2px 10px rgba(255, 56, 96, 0.3)'
        }}>
          <strong>Connection issue</strong> - Changes will not sync with other devices
          <br />
          <small>Please check your internet connection or try again later</small>
        </div>
      )}

      {showInfoModal && (
        <>
          <div className="info-modal-overlay" onClick={() => setShowInfoModal(false)}></div>
          <div className="info-modal-content">
            <button className="info-modal-close" onClick={() => setShowInfoModal(false)}>&times;</button>
            <h2 className="info-modal-header">What is Level Up?</h2>
            <div className="info-modal-body">
              Level Up is a fun way to earn screen time by doing amazing work!<br/>
              <div style={{ marginLeft: '20px', marginTop: '10px' }}>
                🎮 You can earn up to 60 points every weekday (Mon-Fri).<br/>
                🎯 Every task you finish = points.<br/>
                ⏳ 1 point = 1 minute of screen time!
              </div>

              <div style={{ marginTop: '20px' }}>
                <strong>💡 Rules to Remember</strong><br/>
                <div style={{ marginLeft: '20px' }}>
                  🧠 You must finish math and spelling before you use any screen time.<br/>
                  🔁 Want to save points for tomorrow? Ask a parent first!<br/>
                  🎲 Mix and match different tasks to earn your 60 points.
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <strong>✔️ Tips</strong><br/>
                <div style={{ marginLeft: '20px' }}>
                  - Make smart choices.<br/>
                  - Ask questions if you're unsure.<br/>
                  - Have fun learning and leveling up!
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reset confirmation modal */}
      {showResetConfirmation && (
        <>
          <div className="info-modal-overlay" onClick={() => setShowResetConfirmation(false)}></div>
          <div className="info-modal-content">
            <button className="info-modal-close" onClick={() => setShowResetConfirmation(false)}>&times;</button>
            <h2 className="info-modal-header">Reset for New Day?</h2>
            <div className="info-modal-body">
              Are you sure you want to reset all activities? This will mark all activities as incomplete and reset any counters to zero.
            </div>
            <div className="modal-button-group">
              <button 
                onClick={() => setShowResetConfirmation(false)} 
                className="modal-button cancel"
              >
                Cancel
              </button>
              <button 
                onClick={confirmReset} 
                className="modal-button confirm"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </>
      )}

      <div className="activities-wrapper" style={{ 
        paddingBottom: isIOS ? '80px' : '40px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        height: isIOS ? 'calc(100vh - 130px)' : 'auto'
      }}>
        {renderActivities()}
      </div>

      {selectedActivity && (
        <ActivityModal
          activity={selectedActivity}
          onClose={handleCloseModal}
          onUpdate={handleActivityUpdate}
        />
      )}
      
      {/* Real-time update notification */}
      {showNotification && (
        <div className="update-notification">
          {notificationMessage}
        </div>
      )}
      
      {/* iOS-specific notification */}
      {isIOS && forceIOSNotification && (
        <div className="ios-notification" style={{
          position: 'fixed',
          top: '60px', // Move it down a bit to clear the app title
          left: '50%',
          transform: 'translate3d(-50%, 0, 0)',
          background: 'rgba(0, 234, 255, 0.95)',
          color: '#000000',
          padding: '12px 20px',
          borderRadius: '12px',
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 234, 255, 0.7)',
          border: '2px solid #00eaff',
          zIndex: 9999,
          maxWidth: '420px', // Match the scoreboard's max-width
          width: 'calc(100% - 40px)', // Use almost full width on smaller screens
          textAlign: 'center',
          animation: 'fadeInOutTop 4s ease-in-out',
          webkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden'
        }}>
          {iosNotificationMessage}
        </div>
      )}
      
      {/* Connected devices indicator - always show when multiple devices connected */}
      {!usingStaticData && connectedClients > 1 && (
        <div className="connection-status-indicator" style={{
          position: 'fixed',
          bottom: isIOS ? '80px' : '15px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 150, 255, 0.95)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '20px',
          fontSize: '0.9rem',
          zIndex: 1000,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
          maxWidth: '90%',
          textAlign: 'center',
          display: 'block',
          border: '2px solid rgba(0, 150, 255, 0.8)',
          fontFamily: 'Share Tech Mono, monospace',
          fontWeight: 'bold',
          WebkitBackdropFilter: 'blur(5px)',
          backdropFilter: 'blur(5px)'
        }}>
          <span role="status">{connectedClients} devices connected</span>
        </div>
      )}
      
      {/* Debug info panel */}
      {debugMode && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.8)',
          color: '#00ff00',
          fontFamily: 'monospace',
          fontSize: '12px',
          padding: '10px',
          zIndex: 9999,
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          <div>WebSocket ID: {socketRef.current?.id || 'Not connected'}</div>
          <div>Connected: {socketRef.current?.connected ? 'Yes' : 'No'}</div>
          <div>Devices: {connectedClients}</div>
          <div>Static Data: {usingStaticData ? 'Yes' : 'No'}</div>
          <div>Activities: {activities.length}</div>
          <div>Completed: {activities.filter(a => a.completed).length}</div>
          <div>Points: {totalPoints}</div>
          <div>iOS: {isIOS ? 'Yes' : 'No'}</div>
          <div>Using Fallback: {useTableFallback ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}

export default App; 