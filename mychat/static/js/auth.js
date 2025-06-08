const loginForm = document.getElementById('login-form')
const registerForm = document.getElementById('register-form')
const authTitle = document.getElementById('auth-title')
document.getElementById('to-register').onclick = () => {
    loginForm.classList.remove('active')
    registerForm.classList.add('active')
    authTitle.textContent = 'Регистрация'
}
document.getElementById('to-login').onclick = () => {
    registerForm.classList.remove('active')
    loginForm.classList.add('active')
    authTitle.textContent = 'Войти'
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const uname = document.getElementById('login-username').value.trim()
    const pwd = document.getElementById('login-password').value
    const errorEl = document.getElementById('login-error')
    errorEl.style.display = 'none'

    try {
        const res = await fetch('/api/auth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uname, password: pwd })
        })
        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Ошибка входа')
        }
        const data = await res.json()
        localStorage.setItem('accessToken', data.access)
        localStorage.setItem('refreshToken', data.refresh)
        const exp = JSON.parse(atob(data.access.split('.')[1])).exp
        localStorage.setItem('accessExp', exp)
        window.location.href = '/'
    } catch (err) {
        errorEl.textContent = err.message
        errorEl.style.display = 'block'
    }
})

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const uname = document.getElementById('register-username').value.trim()
    const email = document.getElementById('register-email').value.trim()
    const pwd = document.getElementById('register-password').value
    const pwd2 = document.getElementById('register-password-confirm').value
    const errorEl = document.getElementById('register-error')
    errorEl.style.display = 'none'

    if (pwd !== pwd2) {
        errorEl.textContent = 'Пароли не совпадают'
        errorEl.style.display = 'block'
        return
    }

    try {
        const res = await fetch('/api/auth/register/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: uname, email, password: pwd })
        })
        if (!res.ok) {
            const data = await res.json()
            const msg = Object.values(data).flat().join(' ')
            throw new Error(msg || 'Ошибка регистрации')
        }

        loginForm.classList.add('active')
        registerForm.classList.remove('active')
        authTitle.textContent = 'Войти'
        alert('Регистрация прошла успешно! Войдите под своими данными.')
    } catch (err) {
        errorEl.textContent = err.message
        errorEl.style.display = 'block'
    }
})