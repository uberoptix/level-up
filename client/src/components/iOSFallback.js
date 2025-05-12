import React from 'react';

function iOSFallback({ activities, onActivityClick, isLoading = false }) {
  // Show loading state
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
  
  // No activities found, but not loading
  if (!activities || activities.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        color: 'white', 
        padding: '40px 20px',
        fontFamily: 'Share Tech Mono, monospace',
        margin: '20px auto',
        maxWidth: '600px'
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
      </div>
    );
  }

  const containerStyle = {
    padding: '10px', 
    width: '100%',
    maxWidth: '900px',
    margin: '0 auto',
    boxSizing: 'border-box',
    marginBottom: '0',
    paddingBottom: '80px'
  };

  // Render activities in a list-like format that works better on iOS
  return (
    <div style={containerStyle} className="ios-fallback-container">
      {activities.map(activity => {
        const isCounterType = activity.type === 'counter';
        const counterValue = activity.count || 0;
        const isCompleted = isCounterType ? counterValue > 0 : activity.completed;
        const totalPoints = isCounterType ? activity.points * counterValue : activity.points;
        
        return (
          <div 
            key={activity.id}
            onClick={() => onActivityClick(activity)}
            style={{
              backgroundColor: isCompleted ? '#1a3322' : '#1a2233',
              border: isCompleted ? '2px solid #2ed573' : '2px solid #00eaff',
              borderRadius: '10px',
              padding: '15px',
              cursor: 'pointer',
              marginBottom: '16px',
              fontFamily: 'Share Tech Mono, monospace'
            }}
            data-activity-id={activity.id}
            data-completed={isCompleted ? "true" : "false"}
          >
            <div style={{ 
              fontSize: '1.4rem',
              color: '#e6e6e6',
              marginBottom: '10px'
            }}>
              {activity.name}
            </div>
            <div style={{ 
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: isCompleted ? '#2ed573' : '#00eaff',
              marginBottom: '7px'
            }}>
              {totalPoints} points
            </div>
            <div style={{ 
              fontSize: '1rem',
              color: '#b6b6b6'
            }}>
              {isCounterType ? (
                counterValue > 0 ? `${counterValue} completed! Tap to change` : 'Tap to track completions'
              ) : (
                isCompleted ? 'Completed!' : 'Click to mark as complete'
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default iOSFallback; 