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

// Detect iOS Safari - improved detection
const isIOSSafari = () => {
  const ua = window.navigator.userAgent;
  const isIPad = !!ua.match(/iPad/i) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPhone = !!ua.match(/iPhone/i);
  const isIOS = isIPad || isIPhone;
  const webkit = !!ua.match(/WebKit/i);
  const isSafari = isIOS && webkit && !ua.match(/CriOS/i) && !ua.match(/FxiOS/i);
  
  // Add iPad-specific class if detected
  if (isIPad) {
    document.documentElement.setAttribute('data-device', 'ipad');
  }
  
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
      return;
    }
    
    setNotificationMessage(message);
    setShowNotification(true);
    
    // Hide notification after 4 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  }, [connectedClients, isIOS, showIOSNotification]);

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

  // Modify the fetchActivities function to use localStorage as fallback
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
      // Show connection error state but keep any existing activities
      setUsingStaticData(true);
      displayNotification('Connection to server failed - updates will not sync');
    } finally {
      setIsLoading(false);
    }
  }, [calculateTotalPoints, displayNotification]);

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
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Determine correct Socket.IO URL - always use explicit port for mobile
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5001'
      : `${window.location.protocol}//${window.location.hostname}:5001`;
    
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
          httpRequestSent = true;
          fetchActivities();
        }
      }, 2000);
    };
    
    // Start the fallback timer
    fetchActivitiesWithDelay();

    // Socket events
    socketRef.current.on('connect', () => {
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
      initialDataReceived = true;
      
      if (data.activities && data.activities.length > 0) {
        setUsingStaticData(false);
        setActivities(data.activities);
        calculateTotalPoints(data.activities);
        if (data.shouldReset) {
          setShowResetPrompt(true);
        }
      }
      
      setIsLoading(false);
    });

    socketRef.current.on('activity-updated', (data) => {
      try {
        // Get the ID of the updated activity
        const updatedId = data.activityId;
        
        // Check if this update was initiated by the current client
        const isUserAction = updatedId && userInitiatedActions.current.hasOwnProperty(updatedId);
        
        // Check for valid activities array to prevent errors
        if (!data.activities || !Array.isArray(data.activities)) {
          return;
        }
        
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
          
          if (now - lastNotificationTime > 3000) {
            // Show notification that activities were updated
            displayNotification('Activities have been updated by another device');
            userInitiatedActions.current.lastNotificationTime = now;
            
            // Focus on using our dedicated notification system for iOS - no alerts
            if (isIOS) {
              showIOSNotification('Activities have been updated by another device');
            }
          }
          
          // Close any open activity modal to prevent conflicts
          setSelectedActivity(null);
        } else {
          // Clear the action from our tracking object
          delete userInitiatedActions.current[updatedId];
        }
        
        // Ensure loading is complete
        setIsLoading(false);
      } catch (error) {
        // Silent error handling in production
      }
    });

    socketRef.current.on('activities-reset', (data) => {
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
      // Implement more stable connection count logic
      // Only update if the count is different and not temporarily fluctuating
      const newCount = data.count;
      
      // For iOS devices, prevent rapid fluctuation in connected count
      if (isIOS) {
        // Only update if the count is stable for 2+ seconds or differs by more than 1
        if (Math.abs(newCount - stableConnectedClientsRef.current) > 1 || 
            (newCount !== connectedClients && Date.now() - lastConnectionUpdateTime.current > 2000)) {
          
          stableConnectedClientsRef.current = newCount;
          lastConnectionUpdateTime.current = Date.now();
          setConnectedClients(newCount);
        }
      } else {
        // For non-iOS devices, update immediately
        setConnectedClients(newCount);
      }
    });

    // Socket error handling
    socketRef.current.on('connect_error', (error) => {
      if (!initialDataReceived && !httpRequestSent) {
        httpRequestSent = true;
        fetchActivities();
      }
    });
    
    socketRef.current.on('disconnect', (reason) => {
      socketConnectedRef.current = false;
    });

    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [fetchActivities, usingStaticData, activities.length, calculateTotalPoints, displayNotification]);

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
    // Get the activity details
    const currentActivity = activities.find(a => a.id === activityId);
    if (!currentActivity) {
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
    
    // Update the UI immediately
    const updatedActivities = activities.map(activity => 
      activity.id === activityId ? updatedActivity : activity
    );
    setActivities(updatedActivities);
    calculateTotalPoints(updatedActivities);
    
    // Send to server via Socket.IO if connected
    if (socketRef.current && socketRef.current.connected) {
      try {
        socketRef.current.emit('activity-update', {
          activityId,
          ...updatePayload,
          timestamp: updateTimestamp
        });
      } catch (error) {
        // Fallback to HTTP if socket fails
        sendActivityUpdateToServer(activityId, updatePayload);
      }
    } else {
      // Send via HTTP if not connected to socket
      sendActivityUpdateToServer(activityId, updatePayload);
    }
  };

  const handleReset = () => {
    setShowResetConfirmation(true);
  };

  const confirmReset = async () => {
    try {
      setShowResetConfirmation(false);
      
      // Send reset via socket first if connected
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('reset-activities');
      } else {
        // Fallback to HTTP
        await axios.post(`${API_URL}/reset`);
      }
      
      // Reset state immediately for better UX
      const resetActivities = activities.map(activity => ({
        ...activity,
        completed: false,
        completedAt: null,
        count: activity.type === 'counter' ? 0 : activity.count
      }));
      
      setActivities(resetActivities);
      calculateTotalPoints(resetActivities);
      setSelectedActivity(null);
      setShowResetPrompt(false);
      
    } catch (error) {
      displayNotification('Error resetting activities. Please try again.');
    }
  };

  const getScoreStatus = () => {
    if (totalPoints >= 60) return { status: 'excellent', message: 'Excellent work! 🏆' };
    if (totalPoints >= 45) return { status: 'great', message: 'Great job! 🌟' };
    if (totalPoints >= 30) return { status: 'good', message: 'Good progress! 👍' };
    if (totalPoints >= 15) return { status: 'okay', message: 'Keep going! 💪' };
    return { status: 'start', message: 'Ready to start! 🚀' };
  };

  const renderActivities = () => {
    if (useTableFallback || isIOS) {
      return (
        <IOSFallback 
          activities={activities}
          onActivityClick={handleActivityClick}
          totalPoints={totalPoints}
          getScoreStatus={getScoreStatus}
          requiredActivitiesCompleted={requiredActivitiesCompleted}
          isLoading={isLoading}
        />
      );
    } else if (window.innerWidth >= 1024 && !navigator.userAgent.match(/Mobi|Android/i)) {
      // Desktop layout
      return (
        <div className="activities-container">
          <div className="activity-grid">
            {activities.map((activity) => (
              <div 
                className="activity-wrapper" 
                key={activity.id}
                onClick={() => handleActivityClick(activity)}
              >
                <ActivityCard activity={activity} />
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      // Mobile Safari and other mobile browsers layout
      const completedActivities = activities.filter(activity => activity.completed);
      const incompleteActivities = activities.filter(activity => !activity.completed);
      
      return (
        <div className="activities-container mobile-layout">
          {incompleteActivities.map((activity) => (
            <div 
              className="activity-wrapper" 
              key={activity.id}
              onClick={() => handleActivityClick(activity)}
            >
              <SafariActivityCard activity={activity} />
            </div>
          ))}
          
          {completedActivities.length > 0 && (
            <>
              <div className="section-divider">
                <h3>Completed Activities ✅</h3>
              </div>
              {completedActivities.map((activity) => (
                <div className="activity-row" key={`row-${activity.id}`}>
                  <div className="activity-wrapper" key={activity.id}
                    onClick={() => handleActivityClick(activity)}>
                    <SafariActivityCard activity={activity} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      );
    }
  };

  const sendActivityUpdateToServer = async (activityId, payload) => {
    try {
      const url = `${API_URL}/activities/${activityId}`;
      
      // First try fetch
      try {
        const fetchResponse = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          credentials: 'omit',
        });
        
        if (fetchResponse.ok) {
          return;
        }
      } catch (fetchError) {
        // Fetch failed, try XMLHttpRequest fallback
      }
      
      // XMLHttpRequest fallback for maximum compatibility
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Success
        }
      };
      
      xhr.send(JSON.stringify(payload));
      
    } catch (error) {
      // Silent error handling
    }
  };

  // Set up iOS polling for activity updates (iOS Safari compatibility)
  useEffect(() => {
    if (!isIOS) return;
    
    let previousActivitiesState = JSON.stringify(activities);
    
    const pollForChanges = () => {
      setTimeout(() => {
        // Check if activities have changed
        const currentActivitiesState = JSON.stringify(activities);
        if (currentActivitiesState !== previousActivitiesState && 
            Object.keys(userInitiatedActions.current).length === 0) {
          // Activities changed from an external source
          // This helps with iOS Safari's WebSocket limitations
        }
        previousActivitiesState = currentActivitiesState;
        
        // Continue polling
        pollForChanges();
      }, 1000); // Poll every second
    };
    
    pollForChanges();
  }, [isIOS, activities]);

  const scoreStatus = getScoreStatus();

  return (
    <div className="App">
      {/* Top banner with connection status for multiple devices */}
      {connectedClients > 1 && (
        <div className="connection-banner">
          <span className="connection-icon">🌐</span>
          {connectedClients} devices connected • Changes sync in real-time
        </div>
      )}

      {/* Special iOS notification that appears in a centered position */}
      {forceIOSNotification && (
        <div className="ios-notification">
          {iosNotificationMessage}
        </div>
      )}

      <header className="App-header">
        <div className="header-content">
          <div className="title-section">
            <h1>Level Up! 🎯</h1>
            <p>Complete activities to earn points</p>
          </div>
          
          <div className="score-section">
            <div className={`score-display ${scoreStatus.status}`}>
              <div className="score-number">{totalPoints}</div>
              <div className="score-label">POINTS</div>
            </div>
            <div className="score-message">{scoreStatus.message}</div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading activities...</p>
          </div>
        ) : (
          renderActivities()
        )}
      </main>

      {/* Reset button - only show if there are completed activities */}
      {activities.some(a => a.completed) && (
        <div className="reset-section">
          <button 
            className="reset-button"
            onClick={handleReset}
          >
            Reset for New Day
          </button>
        </div>
      )}

      {/* Floating Action Button for info */}
      <button 
        className="info-fab"
        onClick={() => setShowInfoModal(true)}
        aria-label="Show information"
      >
        ℹ️
      </button>

      {/* Activity modal */}
      {selectedActivity && (
        <ActivityModal
          activity={selectedActivity}
          onClose={handleCloseModal}
          onUpdate={handleActivityUpdate}
        />
      )}

      {/* Info modal */}
      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal-content info-modal" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setShowInfoModal(false)}>×</button>
            <h2>How to Use Level Up! 🎯</h2>
            <div className="info-content">
              <p><strong>🎯 Goal:</strong> Earn points by completing educational activities!</p>
              <p><strong>📚 Activities:</strong> Click on any activity card to mark it as complete.</p>
              <p><strong>🔢 Counter Activities:</strong> Some activities (like "Extra Math Page") can be completed multiple times for additional points.</p>
              <p><strong>⭐ Required Activities:</strong> Complete both Khan Academy Math and Spelling Workbook to unlock the excellent score message!</p>
              <p><strong>🔄 Reset:</strong> Use "Reset for New Day" to start fresh each day.</p>
              <p><strong>🌐 Multi-Device:</strong> Your progress syncs across all devices in real-time!</p>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirmation modal */}
      {showResetConfirmation && (
        <div className="modal-overlay">
          <div className="modal-content reset-confirmation">
            <h2>Reset Activities?</h2>
            <p>This will mark all activities as incomplete and reset counters to 0. Are you sure?</p>
            <div className="modal-buttons">
              <button 
                className="cancel-button"
                onClick={() => setShowResetConfirmation(false)}
              >
                Cancel
              </button>
              <button 
                className="confirm-button"
                onClick={confirmReset}
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom notification for non-iOS devices */}
      {showNotification && !isIOS && (
        <div className="notification">
          {notificationMessage}
        </div>
      )}

      {/* Static data warning */}
      {usingStaticData && (
        <div className="static-data-warning">
          ⚠️ Offline mode - changes will not sync between devices
        </div>
      )}
    </div>
  );
}

export default App; 