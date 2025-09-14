// API Configuration - Use relative URL to avoid CORS issues
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function() {
    // Check if already logged in
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        // Verify token is still valid
        verifyToken(authToken).then(valid => {
            if (valid) {
                redirectToApp();
            } else {
                localStorage.removeItem('authToken');
            }
        });
    }

    // Initialize login form
    initializeLoginForm();
});

function initializeLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const buttonText = document.getElementById('buttonText');
    const spinner = document.getElementById('spinner');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Please enter both email and password');
            return;
        }

        // Show loading state
        setLoadingState(true);
        hideError();

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Login successful
                console.log('Login successful, role:', data.role);
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('userRole', data.role);

                // Always redirect to My Games as the first screen
                window.location.href = '/my-games.html';
            } else {
                // Login failed
                console.error('Login failed:', response.status, response.statusText);
                showError(data.error || `Login failed (${response.status})`);
            }
        } catch (error) {
            console.error('Login error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                showError('Cannot connect to API server. Please ensure the backend is running.');
            } else {
                showError('Connection error. Please try again.');
            }
        } finally {
            setLoadingState(false);
        }
    });

    function setLoadingState(loading) {
        loginButton.disabled = loading;
        buttonText.style.display = loading ? 'none' : 'block';
        spinner.style.display = loading ? 'block' : 'none';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }
}

async function verifyToken(token) {
    try {
        const response = await fetch(`${API_BASE}/games`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

function redirectToApp() {
    window.location.href = '/my-games.html';
}