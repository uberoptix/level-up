import React, { useState, useRef } from 'react';
import './ActivityModal.css';

function ActivityModal({ activity, onClose, onUpdate }) {
  const [localCompleted, setLocalCompleted] = useState(activity.completed);
  const [localCompletedAt, setLocalCompletedAt] = useState(activity.completedAt);
  const [localCount, setLocalCount] = useState(activity.count || 0);
  const [loading, setLoading] = useState(false);
  
  // Track if we want to prevent modal from closing
  const preventClose = useRef(false);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleToggle = async () => {
    setLoading(true);
    const newCompleted = !localCompleted;
    let newCompletedAt = null;
    if (newCompleted) {
      newCompletedAt = new Date().toISOString();
    }
    setLocalCompleted(newCompleted);
    setLocalCompletedAt(newCompletedAt);
    
    // Close modal immediately to provide instant feedback
    onClose();
    
    // Then update in the background
    await onUpdate(activity.id, newCompleted);
    setLoading(false);
  };

  // For counter activities, we create two dedicated functions
  const incrementCounter = (e) => {
    // Stop event propagation to prevent it from reaching the overlay
    e.stopPropagation();
    
    // Set preventClose flag to true
    preventClose.current = true;
    
    const newCount = localCount + 1;
    setLocalCount(newCount);
    onUpdate(activity.id, true, newCount);
    
    // Reset the flag after a short delay
    setTimeout(() => {
      preventClose.current = false;
    }, 100);
  };

  const decrementCounter = (e) => {
    // Stop event propagation to prevent it from reaching the overlay
    e.stopPropagation();
    
    // Set preventClose flag to true
    preventClose.current = true;
    
    if (localCount > 0) {
      const newCount = localCount - 1;
      setLocalCount(newCount);
      onUpdate(activity.id, newCount > 0, newCount);
    }
    
    // Reset the flag after a short delay
    setTimeout(() => {
      preventClose.current = false;
    }, 100);
  };

  // This is the key function that determines if we should close the modal
  const modalCloseHandler = (e) => {
    // If we're clicking inside the modal content, don't close
    if (e.target.closest('.modal-content') && e.target !== e.currentTarget) {
      return;
    }
    
    // If we just clicked a counter button, don't close
    if (preventClose.current) {
      return;
    }
    
    // Otherwise, if we're clicking the overlay directly, close the modal
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Modal content that will remain completely separate from the overlay
  const modalContent = (
    <div 
      className="modal-content" 
      onClick={(e) => e.stopPropagation()} // Prevent clicks from reaching the overlay
    >
      <button className="close-button" onClick={onClose}>&times;</button>
      <h2 className="modal-title">{activity.name}</h2>
      <p className="modal-description">{activity.description}</p>
      <div className="modal-points">
        {activity.type === 'counter' 
          ? `${activity.points} points per activity × ${localCount} = ${activity.points * localCount} points` 
          : `${activity.points} points`}
      </div>
      
      {activity.type === 'counter' ? (
        <div className="counter-controls">
          <button 
            type="button"
            className="counter-button decrement"
            onClick={decrementCounter}
            disabled={localCount === 0}
          >
            −
          </button>
          <span className="counter-value">{localCount}</span>
          <button 
            type="button"
            className="counter-button increment"
            onClick={incrementCounter}
          >
            +
          </button>
        </div>
      ) : (
        <div className="button-group">
          <button
            type="button"
            className={`retro-button ${!localCompleted ? 'complete' : 'incomplete'}`}
            onClick={handleToggle}
            disabled={loading}
          >
            {localCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
          </button>
        </div>
      )}
      
      <div className="timestamp">
        {localCompletedAt && localCompleted ? `Completed on: ${formatDate(localCompletedAt)}` : ''}
      </div>
    </div>
  );

  // The main modal component with a completely separate overlay handler
  return (
    <div 
      className="modal-overlay" 
      onClick={modalCloseHandler}
    >
      {modalContent}
    </div>
  );
}

export default ActivityModal;