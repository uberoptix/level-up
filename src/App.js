import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const App = () => {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [setShowResetPrompt] = useState(false);
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
  const socketConnectedRef = useRef(false);

  // Define fetchActivities before the useEffect that needs it and wrap it in useCallback
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
  }, [calculateTotalPoints, displayNotification, setActivities, setIsLoading, setShowResetPrompt, setUsingStaticData]);

  // Function to show a timed notification
  const displayNotification = useCallback((message) => {
    setNotificationMessage(message);
    setShowNotification(true);
    
    // Hide notification after 4 seconds
    setTimeout(() => {
      setShowNotification(false);
    }, 4000);
  }, []);

  // Check if both Khan Academy Math and Spelling Workbook are completed
  const khanCompleted = activities.find(a => a.name.includes("Khan Academy Math"))?.completed || false;
  const spellingCompleted = activities.find(a => a.name.includes("Spelling Workbook"))?.completed || false;
  setRequiredActivitiesCompleted(khanCompleted && spellingCompleted);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Set iOS detection on mount
    const isiOS = isIOSSafari();
    setIsIOS(isiOS);
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log('Disconnecting Socket.IO');
        socketRef.current.disconnect();
      }
    };
  }, [fetchActivities, usingStaticData, activities.length, calculateTotalPoints, displayNotification]);

  return (
    <div>
      {/* Your component JSX here */}
    </div>
  );
};

export default App;
