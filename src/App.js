import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateMessage from './pages/CreateMessage';
import EditMessage from './pages/EditMessage';
import Profile from './pages/Profile';
import Templates from './pages/Templates';
import Analytics from './pages/Analytics';
import DeliveryStatus from './pages/DeliveryStatus';
import ResetPassword from './pages/ResetPassword';
import Success from './pages/Success';
import ProtectedRoute from './components/ProtectedRoute';
import { useActivityTracking } from './hooks/useActivityTracking';
import './aws-config'; // Import AWS configuration

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  useActivityTracking(); // Track user activity across the app

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
                      <Route 
              path="/create-message" 
              element={
                <ProtectedRoute>
                  <CreateMessage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/edit-message/:messageId" 
              element={
                <ProtectedRoute>
                  <EditMessage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/templates" 
              element={
                <ProtectedRoute>
                  <Templates />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/delivery-status" 
              element={
                <ProtectedRoute>
                  <DeliveryStatus />
                </ProtectedRoute>
              } 
            />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/success" element={<Success />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 