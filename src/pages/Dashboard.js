import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messageAPI } from '../services/api';
import { Plus, MessageSquare, Clock, CheckCircle, AlertCircle, Heart, Edit, Trash2, FileText, BarChart3, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        const response = await messageAPI.getMessages();
        setMessages(response.messages || []);
        
        // Update user activity
        try {
          await messageAPI.updateActivity();
        } catch (error) {
          console.error('Error updating activity:', error);
        }
      } catch (error) {
        toast.error('Failed to fetch messages. Please try again.');
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchUserProfile = async () => {
      try {
        const profile = await messageAPI.getUserProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchMessages();
    fetchUserProfile();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unpaid':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'delivered':
        return 'Delivered';
      case 'unpaid':
        return 'Payment Required';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAccountCreatedDate = () => {
    if (userProfile?.createdAt) {
      return formatDate(userProfile.createdAt);
    }
    // Fallback to Cognito attributes if available
    if (user?.attributes?.email_verified === true) {
      return 'Recently';
    }
    return 'N/A';
  };

  const getDeliveryInfo = (message) => {
    if (message.deliveryType === 'date') {
      return `Will be delivered on ${formatDate(message.triggerValue)}`;
    } else {
      return `Will be delivered after ${message.triggerValue} months of inactivity`;
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (window.confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      try {
        await messageAPI.deleteMessage(messageId);
        toast.success('Message deleted successfully');
        // Refresh messages
        const response = await messageAPI.getMessages();
        setMessages(response.messages || []);
      } catch (error) {
        console.error('Error deleting message:', error);
        toast.error('Failed to delete message');
      }
    }
  };

  const handleEditMessage = (message) => {
    // Navigate to edit page with message data
    navigate(`/edit-message/${message.messageId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Your Messages</h1>
              <p className="text-gray-600 mt-2">
                Manage your digital legacy messages
              </p>
            </div>
            <Link
              to="/create-message"
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Create New Message</span>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{messages.length}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {messages.filter(m => m.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {messages.filter(m => m.status === 'delivered').length}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recipients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(messages.map(m => m.recipient)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/create-message')}>
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Plus className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New Message</h3>
                <p className="text-gray-600">Send a heartfelt message to your loved ones</p>
              </div>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/templates')}>
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
                <p className="text-gray-600">Use and manage reusable message templates</p>
              </div>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/delivery-status')}>
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Truck className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Delivery Status</h3>
                <p className="text-gray-600">Track the delivery progress of your messages</p>
              </div>
            </div>
          </div>

          <div className="card hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/analytics')}>
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Message Analytics</h3>
                <p className="text-gray-600">View insights and statistics about your messages</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages List */}
        <div className="card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Messages</h2>
            <p className="text-gray-600">View and manage your digital legacy messages</p>
          </div>

          {messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first message to leave a lasting legacy for your loved ones.
              </p>
              <Link to="/create-message" className="btn-primary">
                Create Your First Message
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.messageId}
                  className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          {message.type === 'text' ? (
                            <MessageSquare className="h-5 w-5 text-primary-600" />
                          ) : message.type === 'audio' ? (
                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">A</span>
                            </div>
                          ) : message.type === 'files' ? (
                            <FileText className="h-5 w-5 text-green-600" />
                          ) : (
                            <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">V</span>
                            </div>
                          )}
                          <span className="font-medium text-gray-900">
                            {message.type === 'text' ? 'Text Message' : 
                             message.type === 'audio' ? 'Audio Message' : 
                             message.type === 'files' ? 'Files Message' : 'Video Message'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(message.status)}
                          <span className={`text-sm font-medium ${
                            message.status === 'delivered' ? 'text-green-600' :
                            message.status === 'pending' ? 'text-yellow-600' :
                            message.status === 'unpaid' ? 'text-orange-600' :
                            message.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {getStatusText(message.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Recipient:</span> {message.recipient}
                        </div>
                        <div>
                          <span className="font-medium">Delivery:</span> {getDeliveryInfo(message)}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {formatDate(message.createdAt)}
                        </div>
                        {message.deliveredAt && (
                          <div>
                            <span className="font-medium">Delivered:</span> {formatDate(message.deliveredAt)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {message.status !== 'delivered' && (
                        <>
                          <button 
                            onClick={() => handleEditMessage(message)}
                            className="text-blue-400 hover:text-blue-600 p-2"
                            title="Edit message"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMessage(message.messageId)}
                            className="text-red-400 hover:text-red-600 p-2"
                            title="Delete message"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button className="text-gray-400 hover:text-gray-600 p-2" title="View details">
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="mt-8 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{user?.attributes?.email || user?.username || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Member since:</span>
              <span className="font-medium">
                {getAccountCreatedDate()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last login:</span>
              <span className="font-medium">Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 