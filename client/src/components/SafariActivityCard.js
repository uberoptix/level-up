import React from 'react';
import '../styles/ActivityCard.css';

// Safari-optimized card component
function SafariActivityCard({ activity, onClick }) {
  const isCounter = activity.type === 'counter';
  const counterValue = activity.count || 0;
  const hasCompletions = isCounter && counterValue > 0;
  const isCompleted = isCounter ? hasCompletions : activity.completed;
  const totalPoints = isCounter ? activity.points * counterValue : activity.points;
  
  return (
    <div 
      className={`safari-activity-card ${isCompleted ? 'completed' : ''}`}
      onClick={onClick}
      data-activity-id={activity.id}
      data-completed={isCompleted ? "true" : "false"}
      style={{
        marginBottom: '16px' // Ensure consistent bottom margin
      }}
    >
      <div className="safari-card-content">
        <div className="safari-card-title">
          {activity.name}
        </div>
        <div className="safari-card-points">
          {isCounter 
            ? counterValue > 0 
              ? `${totalPoints} points` 
              : `${activity.points} points`
            : `${totalPoints} points`
          }
        </div>
        <div className="safari-card-status-text">
          {isCounter ? (
            counterValue > 0 ? `${counterValue} completed! Tap to change` : 'Tap to track completions'
          ) : (
            isCompleted ? 'Completed!' : 'Click to mark as complete'
          )}
        </div>
      </div>
    </div>
  );
}

export default SafariActivityCard; 