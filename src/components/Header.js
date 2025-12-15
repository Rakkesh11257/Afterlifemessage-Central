import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, LogOut, User } from 'lucide-react';

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Heart className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">AfterLifeMessage.in</span>
          </Link>

          <nav className="flex items-center space-x-6">
            {user ? (
              <>
                <Link 
                  to="/dashboard" 
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Dashboard
                </Link>
                <Link 
                  to="/create-message" 
                  className="btn-primary"
                >
                  Create Message
                </Link>
                <div className="flex items-center space-x-2">
                  <Link 
                    to="/profile" 
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <User className="h-5 w-5" />
                    <span className="text-sm">{user?.attributes?.email || user?.username}</span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link 
                  to="/login" 
                  className="btn-primary"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header; 