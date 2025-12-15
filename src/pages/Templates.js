import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Copy, MessageSquare, Mic, Video, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const LOCAL_STORAGE_KEY = 'afterlife_templates';

const Templates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Sample templates - in real app, these would come from API
  const sampleTemplates = [
    {
      id: '1',
      name: 'Birthday Wish',
      type: 'text',
      content: 'Happy Birthday! 🎉 On this special day, I want you to know how much you mean to me. May your day be filled with joy, laughter, and wonderful memories. You deserve all the happiness in the world!',
      category: 'Celebration'
    },
    {
      id: '2',
      name: 'Thank You Message',
      type: 'text',
      content: 'Thank you for being such an important part of my life. Your kindness, support, and love have meant everything to me. I am truly grateful to have you in my life.',
      category: 'Gratitude'
    },
    {
      id: '3',
      name: 'Love Letter',
      type: 'text',
      content: 'My dearest, words cannot express how much you mean to me. You have been my rock, my inspiration, and my greatest joy. I love you more than words can say.',
      category: 'Love'
    },
    {
      id: '4',
      name: 'Life Advice',
      type: 'text',
      content: 'Remember to always follow your heart, be kind to others, and never give up on your dreams. Life is beautiful and you have the power to make it even more wonderful.',
      category: 'Advice'
    }
  ];

  // Load templates from localStorage or use sampleTemplates
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      setTemplates(JSON.parse(stored));
    } else {
      setTemplates(sampleTemplates);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sampleTemplates));
    }
    setLoading(false);
  }, []);

  // Helper to update templates in state and localStorage
  const updateTemplates = (newTemplates) => {
    setTemplates(newTemplates);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newTemplates));
  };

  const handleCreateTemplate = () => {
    setShowCreateModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setShowCreateModal(true);
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      const newTemplates = templates.filter(t => t.id !== templateId);
      updateTemplates(newTemplates);
      toast.success('Template deleted successfully');
    }
  };

  // When a new template is created or edited, update localStorage
  // (Assume you have a function saveTemplate that is called on create/edit)
  // Example usage:
  //   saveTemplate({ id, name, type, content, category })
  // If editing, replace by id; if new, add to array
  const saveTemplate = (template) => {
    let newTemplates;
    if (template.id) {
      // Edit existing
      newTemplates = templates.map(t => t.id === template.id ? template : t);
    } else {
      // New template
      const newId = Date.now().toString();
      newTemplates = [...templates, { ...template, id: newId }];
    }
    updateTemplates(newTemplates);
    setShowCreateModal(false);
    setEditingTemplate(null);
    toast.success('Template saved!');
  };

  const handleUseTemplate = (template) => {
    // Navigate to create message with template data
    navigate('/create-message', { 
      state: { 
        template: template 
      } 
    });
  };

  const handleCopyTemplate = (template) => {
    navigator.clipboard.writeText(template.content);
    toast.success('Template copied to clipboard!');
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'text':
        return <MessageSquare className="h-4 w-4" />;
      case 'audio':
        return <Mic className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Celebration':
        return 'bg-green-100 text-green-800';
      case 'Gratitude':
        return 'bg-blue-100 text-blue-800';
      case 'Love':
        return 'bg-red-100 text-red-800';
      case 'Advice':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
              <h1 className="text-3xl font-bold text-gray-900">Message Templates</h1>
              <p className="text-gray-600 mt-2">
                Create and manage reusable message templates
              </p>
            </div>
            <button
              onClick={handleCreateTemplate}
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Create Template</span>
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(template.type)}
                  <h3 className="font-semibold text-gray-900">{template.name}</h3>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                  {template.category}
                </span>
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {template.content}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleUseTemplate(template)}
                    className="btn-primary text-sm"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => handleCopyTemplate(template)}
                    className="btn-outline text-sm"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEditTemplate(template)}
                    className="p-2 text-blue-600 hover:text-blue-700"
                    title="Edit template"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="p-2 text-red-600 hover:text-red-700"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {templates.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first template to save time when creating messages.
            </p>
            <button onClick={handleCreateTemplate} className="btn-primary">
              Create Your First Template
            </button>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter template name"
                    defaultValue={editingTemplate?.name || ''}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="Celebration">Celebration</option>
                    <option value="Gratitude">Gratitude</option>
                    <option value="Love">Love</option>
                    <option value="Advice">Advice</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message Content
                  </label>
                  <textarea
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your message template..."
                    defaultValue={editingTemplate?.content || ''}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="btn-outline"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveTemplate({
                      id: editingTemplate?.id,
                      name: document.querySelector('input[type="text"]').value,
                      type: 'text', // Default type
                      content: document.querySelector('textarea').value,
                      category: document.querySelector('select').value
                    });
                  }}
                  className="btn-primary"
                >
                  {editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Templates; 