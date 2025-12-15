import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Calendar, MessageSquare, ArrowLeft, Download } from 'lucide-react';
import { messageAPI } from '../services/api';
import toast from 'react-hot-toast';

const Analytics = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState({
    messageStats: [],
    deliveryStats: [],
    recipientStats: [],
    monthlyStats: []
  });
  const [summaryStats, setSummaryStats] = useState({
    totalMessages: 0,
    deliveredMessages: 0,
    uniqueRecipients: 0,
    avgDeliveryTime: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { messages } = await messageAPI.getMessages();
      
      if (messages.length === 0) {
        setAnalytics({
          messageStats: [],
          deliveryStats: [],
          recipientStats: [],
          monthlyStats: []
        });
        setSummaryStats({
          totalMessages: 0,
          deliveredMessages: 0,
          uniqueRecipients: 0,
          avgDeliveryTime: 0
        });
        setLoading(false);
        return;
      }

      // Calculate message type statistics
      const typeStats = {};
      messages.forEach(message => {
        const type = message.type.charAt(0).toUpperCase() + message.type.slice(1);
        typeStats[type] = (typeStats[type] || 0) + 1;
      });

      const messageStats = Object.entries(typeStats).map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / messages.length) * 100)
      }));

      // Calculate delivery statistics by month
      const deliveryByMonth = {};
      messages.forEach(message => {
        const date = new Date(message.createdAt);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        if (!deliveryByMonth[month]) {
          deliveryByMonth[month] = { delivered: 0, pending: 0 };
        }
        if (message.status === 'delivered') {
          deliveryByMonth[month].delivered++;
        } else if (message.status === 'pending') {
          deliveryByMonth[month].pending++;
        }
      });

      const deliveryStats = Object.entries(deliveryByMonth).map(([month, stats]) => ({
        month,
        delivered: stats.delivered,
        pending: stats.pending
      }));

      // Calculate recipient statistics (simplified - just count unique emails)
      const uniqueRecipients = new Set(messages.map(m => m.recipient)).size;
      const recipientStats = [
        { name: 'Unique Recipients', count: uniqueRecipients }
      ];

      // Calculate monthly activity
      const monthlyActivity = {};
      messages.forEach(message => {
        const date = new Date(message.createdAt);
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        monthlyActivity[month] = (monthlyActivity[month] || 0) + 1;
      });

      const monthlyStats = Object.entries(monthlyActivity).map(([month, count]) => ({
        month,
        messages: count
      }));

      // Calculate summary statistics
      const deliveredMessages = messages.filter(m => m.status === 'delivered').length;
      const avgDeliveryTime = deliveredMessages > 0 ? 
        messages.filter(m => m.status === 'delivered' && m.deliveredAt)
          .reduce((sum, m) => {
            const created = new Date(m.createdAt);
            const delivered = new Date(m.deliveredAt);
            return sum + (delivered - created);
          }, 0) / deliveredMessages / (1000 * 60 * 60 * 24) : 0;

      setAnalytics({
        messageStats,
        deliveryStats,
        recipientStats,
        monthlyStats
      });

      setSummaryStats({
        totalMessages: messages.length,
        deliveredMessages,
        uniqueRecipients,
        avgDeliveryTime: Math.round(avgDeliveryTime * 10) / 10
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#dc2626', '#3b82f6', '#10b981', '#f59e0b'];

  const handleExportData = () => {
    // In real app, this would export analytics data
    console.log('Exporting analytics data...');
    toast.success('Export feature coming soon!');
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
              <h1 className="text-3xl font-bold text-gray-900">Message Analytics</h1>
              <p className="text-gray-600 mt-2">
                Insights and statistics about your digital legacy messages
              </p>
            </div>
            <button
              onClick={handleExportData}
              className="btn-outline flex items-center space-x-2"
            >
              <Download className="h-5 w-5" />
              <span>Export Data</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-primary-100 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.totalMessages}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.deliveredMessages}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Recipients</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.uniqueRecipients}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Delivery Time</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.avgDeliveryTime} days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Message Types Distribution */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Types</h3>
            {analytics.messageStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.messageStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ type, percentage }) => `${type}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {analytics.messageStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No messages to display
              </div>
            )}
          </div>

          {/* Monthly Message Activity */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Activity</h3>
            {analytics.monthlyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="messages" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No activity to display
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Delivery Statistics */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Statistics</h3>
            {analytics.deliveryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.deliveryStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
                  <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No delivery data to display
              </div>
            )}
          </div>

          {/* Recipient Categories */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recipient Statistics</h3>
            {analytics.recipientStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.recipientStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No recipient data to display
              </div>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
          {summaryStats.totalMessages > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Message Distribution</h4>
                    <p className="text-gray-600">
                      {analytics.messageStats.length > 0 
                        ? `${analytics.messageStats[0].type} messages are your most used format (${analytics.messageStats[0].percentage}% of all messages)`
                        : 'No message type data available'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Delivery Success Rate</h4>
                    <p className="text-gray-600">
                      {summaryStats.totalMessages > 0 
                        ? `${Math.round((summaryStats.deliveredMessages / summaryStats.totalMessages) * 100)}% of your messages have been successfully delivered`
                        : 'No delivery data available'
                      }
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Recipient Reach</h4>
                    <p className="text-gray-600">
                      You've reached {summaryStats.uniqueRecipients} unique recipient{summaryStats.uniqueRecipients !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-yellow-600 rounded-full mt-2"></div>
                  <div>
                    <h4 className="font-medium text-gray-900">Average Delivery Time</h4>
                    <p className="text-gray-600">
                      {summaryStats.avgDeliveryTime > 0 
                        ? `Messages are delivered in an average of ${summaryStats.avgDeliveryTime} days`
                        : 'No delivery time data available'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No messages found. Create your first message to see analytics!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics; 