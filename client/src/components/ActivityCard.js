import React from 'react';

// Ultra-simplified version for maximum iOS Safari compatibility
function ActivityCard({ activity, onClick, className }) {
  const isCounterType = activity.type === 'counter';
  const counterValue = activity.count || 0;
  const totalPoints = isCounterType ? activity.points * counterValue : activity.points;
  
  const cardStyle = {
    backgroundColor: activity.completed ? '#1a3322' : '#1a2233', 
    borderColor: activity.completed ? '#2ed573' : '#00eaff',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderRadius: '10px',
    padding: '15px',
    marginBottom: '20px',
    position: 'relative',
    display: 'block',
    color: '#e6e6e6',
    fontFamily: 'Share Tech Mono, monospace',
    cursor: 'pointer'
  };

  const nameStyle = {
    fontSize: '1.4rem',
    marginBottom: '10px',
    color: '#e6e6e6'
  };

  const pointsStyle = {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: activity.completed ? '#2ed573' : '#00eaff'
  };

  const statusStyle = {
    fontSize: '1rem',
    color: '#b6b6b6',
    marginTop: '7px'
  };

  return (
    <div 
      style={cardStyle}
      onClick={onClick}
      className={className}
      data-completed={activity.completed ? "true" : "false"}
      data-activity-id={activity.id}
    >
      <h3 style={nameStyle}>{activity.name}</h3>
      <div>
        <div style={pointsStyle}>{totalPoints} points</div>
        
        <div style={statusStyle}>
          {isCounterType ? (
            counterValue > 0 ? `${counterValue} completed!` : 'Tap to track completions'
          ) : (
            activity.completed ? 'Completed!' : 'Click to mark as complete'
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityCard; 