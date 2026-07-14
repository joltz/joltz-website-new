// assets/js/auth.js
// Small shared helper around the /api/auth/* endpoints, used by both
// book.html (login/register to book a court) and admin.html (login +
// role check to reach the admin panel).
window.JoltAuth = (function () {
  "use strict";

  function request(url, options) {
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      });
  }

  return {
    getMe: function () {
      return request('/api/auth/me', { method: 'GET' }).then(function (res) { return res.data.user || null; });
    },
    register: function (name, email, password) {
      return request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: name, email: email, password: password }) });
    },
    login: function (email, password) {
      return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    },
    logout: function () {
      return request('/api/auth/logout', { method: 'POST' });
    }
  };
})();
