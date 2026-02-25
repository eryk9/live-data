// Toggle Password Visibility
function togglePassword() {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleSignupPassword() {
    const input = document.getElementById('signupPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleConfirmPassword() {
    const input = document.getElementById('confirmPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleNewPassword() {
    const input = document.getElementById('newPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleConfirmNewPassword() {
    const input = document.getElementById('confirmNewPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        clearErrors();
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/';
            } else {
                document.getElementById('loginError').textContent = data.message || 'Errore nel login';
                document.getElementById('loginError').classList.add('show');
            }
        } catch (err) {
            console.error('Login error:', err);
            document.getElementById('loginError').textContent = 'Errore di connessione';
            document.getElementById('loginError').classList.add('show');
        }
    });
}

// Signup Form
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const age = document.getElementById('age').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        clearErrors();
        
        // Validazioni
        if (password.length < 8) {
            showError('signupPasswordError', 'Password minimo 8 caratteri');
            return;
        }
        
        if (!/[A-Z]/.test(password)) {
            showError('signupPasswordError', 'Password deve avere almeno 1 maiuscola');
            return;
        }
        
        if (!/[0-9]/.test(password)) {
            showError('signupPasswordError', 'Password deve avere almeno 1 numero');
            return;
        }
        
        if (password !== confirmPassword) {
            showError('confirmPasswordError', 'Le password non corrispondono');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, age, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = '/';
            } else {
                if (data.field) {
                    showError(`signup${data.field}Error`, data.message);
                } else {
                    document.getElementById('signupError').textContent = data.message || 'Errore nella registrazione';
                    document.getElementById('signupError').classList.add('show');
                }
            }
        } catch (err) {
            console.error('Signup error:', err);
            document.getElementById('signupError').textContent = 'Errore di connessione';
            document.getElementById('signupError').classList.add('show');
        }
    });
}

// Forgot Password Form
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgotEmail').value;
        clearErrors();
        
        try {
            const btn = forgotForm.querySelector('button');
            btn.classList.add('loading');
            
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Salva l'email temporaneamente
                sessionStorage.setItem('resetEmail', email);
                // Passa al step 2
                showStep(2);
            } else {
                showError('forgotError', data.message || 'Email non trovata');
            }
            
            btn.classList.remove('loading');
        } catch (err) {
            console.error('Forgot password error:', err);
            showError('forgotError', 'Errore di connessione');
        }
    });
}

// Reset Password Form
const resetForm = document.getElementById('resetForm');
if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = sessionStorage.getItem('resetEmail');
        const code = document.getElementById('resetCode').value;
        const password = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        
        clearErrors();
        
        if (password !== confirmPassword) {
            showError('resetError', 'Le password non corrispondono');
            return;
        }
        
        try {
            const btn = resetForm.querySelector('button');
            btn.classList.add('loading');
            
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, code, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showStep(3);
            } else {
                showError('resetError', data.message || 'Errore nel reset della password');
            }
            
            btn.classList.remove('loading');
        } catch (err) {
            console.error('Reset password error:', err);
            showError('resetError', 'Errore di connessione');
        }
    });
}

// Helper Functions
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.classList.add('show');
    }
}

function clearErrors() {
    document.querySelectorAll('.error').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
}

function showStep(stepNumber) {
    document.querySelectorAll('.auth-step').forEach(step => {
        step.classList.remove('active');
    });
    
    const step = document.getElementById(`step${stepNumber}`);
    if (step) {
        step.classList.add('active');
    }
}

// Check token on page load
window.addEventListener('load', () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    // Se siamo su una pagina di login/signup/forgot e abbiamo un token, vai alla home
    if (token && (window.location.pathname.includes('login') || 
                   window.location.pathname.includes('signup') || 
                   window.location.pathname.includes('forgot'))) {
        window.location.href = '/';
    }
});

// Update header with user info if available
function updateHeader() {
    const user = localStorage.getItem('user');
    if (user) {
        const userData = JSON.parse(user);
        // Puoi aggiornare l'header qui
        console.log('Logged in as:', userData.name);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', updateHeader);
