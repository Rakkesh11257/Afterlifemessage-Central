import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageAPI } from '../services/api';
import { Clock, CheckCircle, AlertCircle, Calendar, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const DeliveryStatus = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await messageAPI.getMessages();
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-orange-100 text-orange-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeliveryInfo = (message) => {
    if (message.deliveryType === 'date') {
      return `Will be delivered on ${formatDate(message.triggerValue)}`;
    } else {
      return `Will be delivered after ${message.triggerValue} months of inactivity`;
    }
  };

  const getTimeUntilDelivery = (message) => {
    if (message.deliveryType === 'date') {
      const deliveryDate = new Date(message.triggerValue);
      const now = new Date();
      const diffTime = deliveryDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return 'Overdue';
      } else if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else {
        return `${diffDays} days`;
      }
    } else {
      return 'Inactivity-based';
    }
  };

  const filteredMessages = messages.filter(message => {
    if (filter === 'all') return true;
    return message.status === filter;
  });

  const stats = {
    total: messages.length,
    pending: messages.filter(m => m.status === 'pending').length,
    delivered: messages.filter(m => m.status === 'delivered').length,
    unpaid: messages.filter(m => m.status === 'unpaid').length,
    failed: messages.filter(m => m.status === 'failed').length
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
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Delivery Status</h1>
              <p className="text-gray-600 mt-2">
                Track the delivery progress of your messages
              </p>
            </div>
            <button
              onClick={fetchMessages}
              className="btn-outline flex items-center space-x-2"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <Mail className="h-6 w-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
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
                <p className="text-2xl font-bold text-gray-900">{stats.delivered}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unpaid</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unpaid}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <div className="flex space-x-2">
            {[
              { key: 'all', label: 'All Messages' },
              { key: 'pending', label: 'Pending' },
              { key: 'delivered', label: 'Delivered' },
              { key: 'unpaid', label: 'Unpaid' },
              { key: 'failed', label: 'Failed' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages List */}
        <div className="card">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Message Delivery Status</h2>
            <p className="text-gray-600">Track the delivery progress of your digital legacy messages</p>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
              <p className="text-gray-600 mb-6">
                {filter === 'all' 
                  ? 'You haven\'t created any messages yet.'
                  : `No ${filter} messages found.`
                }
              </p>
              {filter === 'all' && (
                <button
                  onClick={() => navigate('/create-message')}
                  className="btn-primary"
                >
                  Create Your First Message
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMessages.map((message) => (
                <div key={message.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        {getStatusIcon(message.status)}
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Message to {message.recipient}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                            {getStatusText(message.status)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Message Type:</p>
                          <p className="font-medium capitalize">{message.type}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Delivery Type:</p>
                          <p className="font-medium">{getDeliveryInfo(message)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Time Until Delivery:</p>
                          <p className="font-medium">{getTimeUntilDelivery(message)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Created:</p>
                          <p className="font-medium">{formatDate(message.createdAt)}</p>
                        </div>
                      </div>

                      {message.deliveredAt && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-gray-600 text-sm">Delivered on:</p>
                          <p className="font-medium text-sm">{formatDate(message.deliveredAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryStatus; 