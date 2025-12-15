import { useEffect, useRef } from 'react';
import { messageAPI } from '../services/api';

export const useActivityTracking = () => {
  const lastActivityUpdate = useRef(0);
  const ACTIVITY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    const updateActivity = async () => {
      try {
        await messageAPI.updateActivity();
        lastActivityUpdate.current = Date.now();
      } catch (error) {
        console.error('Error updating activity:', error);
      }
    };

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityUpdate.current > ACTIVITY_UPDATE_INTERVAL) {
        updateActivity();
      }
    };

    // Update activity on initial load
    updateActivity();

    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Update activity every 5 minutes even if no user interaction
    const interval = setInterval(updateActivity, ACTIVITY_UPDATE_INTERVAL);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
      clearInterval(interval);
    };
  }, []);
}; 