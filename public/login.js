document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const statusToast = document.getElementById('statusToast');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem('tvku_admin_token', data.token);
                window.location.href = 'index.html';
            } else {
                showToast(data.error || 'Login failed', 'error');
            }
        })
        .catch(err => {
            showToast('Network error', 'error');
        });
    });

    function showToast(message, type) {
        statusToast.textContent = message;
        statusToast.className = `status-toast show ${type}`;
        setTimeout(() => {
            statusToast.classList.remove('show');
        }, 3000);
    }
});
