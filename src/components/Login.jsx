// Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, signUp } from './authService'; 
import './login.css'; 

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();


  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      const session = await signIn(email, password);
      console.log('Sign in successful', session);
      if (session && typeof session.AccessToken !== 'undefined') {
        sessionStorage.setItem('accessToken', session.AccessToken);
  
        if (sessionStorage.getItem('accessToken')) {
          navigate('/home'); 
        } else {
          console.error('Session token was not set properly.');
          alert('Sign in failed: Could not set session token.'); 
        }
      } else {
        console.error('SignIn session or AccessToken is undefined.');
        alert('Sign in failed: Invalid session data received.'); 
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Sign in failed: ${errorMessage}`);
      console.error('Sign in error details:', error);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      await signUp(email, password, firstName, lastName, address);
      alert('Sign up successful! Please check your email to confirm your account.'); 
      navigate('/confirm', { state: { email } }); 
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Sign up failed: ${errorMessage}`);
      console.error('Sign up error details:', error);
    }
  };

  return (
    <div className="loginForm">
      <h1>Welcome to BirdTag</h1>
      <h4>{isSignUp ? 'Sign up to create an account' : 'Sign in to your account'}</h4>
      <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
        <div>
          <label htmlFor="email">Email</label> 
          <input
            className="inputText"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password">Password</label> 
          <input
            className="inputText"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
        </div>
        {isSignUp && (
          <>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                className="inputText"
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                className="inputText"
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
                required
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                className="inputText"
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                required
                autoComplete="family-name"
              />
            </div>
          </>
        )}
        <button type="submit" className="submitButton"> 
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      <button onClick={() => setIsSignUp(!isSignUp)} className="toggleFormButton">
        {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
      </button>
    </div>
  );
};

export default LoginPage;