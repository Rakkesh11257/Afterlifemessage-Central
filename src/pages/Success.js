import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Heart, Shield, Clock, ArrowRight } from 'lucide-react';

const Success = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Message Created Successfully!
            </h1>
            <p className="text-lg text-gray-600">
              Your heartfelt message has been securely stored and will be delivered when the time is right.
            </p>
          </div>

          <div className="card mb-8">
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <Shield className="h-6 w-6 text-primary-600" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Message Secured</h3>
                  <p className="text-sm text-gray-600">Your message is encrypted and stored safely</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Clock className="h-6 w-6 text-primary-600" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Delivery Scheduled</h3>
                  <p className="text-sm text-gray-600">Will be sent according to your chosen trigger</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Heart className="h-6 w-6 text-primary-600" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">Lifetime Storage</h3>
                  <p className="text-sm text-gray-600">Your message will be preserved forever</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Message is encrypted and stored</p>
                  <p className="text-sm text-gray-600">Your message is now safely locked in our secure vault</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">System monitors delivery conditions</p>
                  <p className="text-sm text-gray-600">We check daily for your chosen delivery trigger</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Message is delivered automatically</p>
                  <p className="text-sm text-gray-600">When conditions are met, your message is sent to your loved one</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Link
              to="/dashboard"
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            
            <Link
              to="/create-message"
              className="btn-secondary w-full"
            >
              Create Another Message
            </Link>
          </div>

          <div className="mt-8 text-sm text-gray-500">
            <p>You will receive a confirmation email shortly.</p>
            <p>Need help? Contact us at support@afterlifemessage.in</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Success; 