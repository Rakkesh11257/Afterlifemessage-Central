import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Shield, Clock, Mail, ArrowRight, Play } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="gradient-bg text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              What if your last words were never delivered?
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-red-100">
              Create heartfelt messages that will be sent to your loved ones after you're gone.
              <br />
              Secure, encrypted, and delivered with care.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/login" 
                className="bg-white text-primary-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <span>Create Your Message</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary-600 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 flex items-center justify-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Watch Demo</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Your Digital Legacy, Secured
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Leave behind messages that matter. Our platform ensures your words reach the people who need them most.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Heartfelt Messages</h3>
              <p className="text-gray-600">
                Write or record personal messages that capture your love, wisdom, and memories for your loved ones.
              </p>
            </div>

            <div className="card text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Military-Grade Security</h3>
              <p className="text-gray-600">
                Your messages are encrypted and stored securely. Only delivered when the time is right.
              </p>
            </div>

            <div className="card text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Timed Delivery</h3>
              <p className="text-gray-600">
                Set specific dates or inactivity triggers. Your messages will be delivered exactly when you choose.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Simple steps to create your digital legacy
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-lg font-semibold mb-2">Create Account</h3>
              <p className="text-gray-600">Sign up securely with your email</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-lg font-semibold mb-2">Write Message</h3>
              <p className="text-gray-600">Record voice or write your heartfelt message</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-lg font-semibold mb-2">Set Delivery</h3>
              <p className="text-gray-600">Choose when to send: date or inactivity</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure & Send</h3>
              <p className="text-gray-600">Pay ₹99 and your message is locked safely</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple Pricing
            </h2>
            <p className="text-xl text-gray-600">
              One-time payment for lifetime peace of mind
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="card text-center border-2 border-primary-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic Message</h3>
                <div className="text-4xl font-bold text-primary-600 mb-2">₹99</div>
                <p className="text-gray-600">One-time payment</p>
              </div>
              
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center">
                  <Mail className="h-5 w-5 text-green-500 mr-3" />
                  <span>1 message to 1 recipient</span>
                </li>
                <li className="flex items-center">
                  <Shield className="h-5 w-5 text-green-500 mr-3" />
                  <span>Military-grade encryption</span>
                </li>
                <li className="flex items-center">
                  <Clock className="h-5 w-5 text-green-500 mr-3" />
                  <span>Date or inactivity trigger</span>
                </li>
                <li className="flex items-center">
                  <Heart className="h-5 w-5 text-green-500 mr-3" />
                  <span>Text or voice message</span>
                </li>
              </ul>

              <Link 
                to="/login" 
                className="btn-primary w-full text-lg py-3"
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold mb-6">
            Don't leave your loved ones wondering
          </h2>
          <p className="text-xl mb-8 text-red-100">
            Create your message today and ensure your voice is heard when it matters most.
          </p>
          <Link 
            to="/login" 
            className="bg-white text-primary-600 hover:bg-gray-100 font-semibold py-3 px-8 rounded-lg text-lg transition-colors duration-200 inline-flex items-center space-x-2"
          >
            <span>Start Your Legacy</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 