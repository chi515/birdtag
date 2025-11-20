// ConfirmUserPage.jsx

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { useState, useEffect } from 'react'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmSignUp } from './authService'; 

const ConfirmUserPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false); 
  const [message, setMessage] = useState(''); 

  useEffect(() => {
    if (location.state && location.state.email) {
      setEmail(location.state.email);
    } else {
      setMessage('Email not found from previous step. Please enter your email.');
    }
  }, [location.state]); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
        alert('Please enter your email.');
        return;
    }
    if (!confirmationCode) {
        alert('Please enter the confirmation code.');
        return;
    }

    setIsLoading(true);
    setMessage(''); 
    try {
      await confirmSignUp(email, confirmationCode);
      setMessage("Account confirmed successfully! Redirecting to login...");
      setTimeout(() => {
        navigate('/login');
      }, 2000); 
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`Failed to confirm account: ${errorMessage}`);
      console.error("Confirmation error details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="loginForm" style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', textAlign: 'center' }}>
      <h2>Confirm Account</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px', textAlign: 'left' }}>Email</label>
          <input
            id="email"
            className="inputText" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <div>
          <label htmlFor="confirmationCode" style={{ display: 'block', marginBottom: '5px', textAlign: 'left' }}>Confirmation Code</label>
          <input
            id="confirmationCode"
            className="inputText" 
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder="Enter confirmation code"
            required
            style={{ width: '100%', padding: '10px', marginBottom: '20px', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
        <button
            type="submit"
            disabled={isLoading}
            style={{ width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
        >
          {isLoading ? 'Confirming...' : 'Confirm Account'}
        </button>
      </form>
      {message && (
        <p style={{ marginTop: '20px', color: message.includes('Failed') || message.includes('failed') ? 'red' : 'green', fontWeight: 'bold' }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default ConfirmUserPage;