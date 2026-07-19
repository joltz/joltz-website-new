(function () {
  "use strict";

  var loginWrap = document.getElementById('admin-login-wrap');
  var deniedWrap = document.getElementById('admin-denied');
  var dashboard = document.getElementById('admin-dashboard');
  if (!loginWrap || !dashboard) return; // not on the admin page

  var loginForm = document.getElementById('admin-login-form');
  var loginMsg = document.getElementById('admin-login-msg');
  var adminLabel = document.getElementById('admin-label');
  var deniedEmail = document.getElementById('denied-email');

  var dashboardInitialized = false;

  function money(cents) { return '$' + (cents / 100).toFixed(2); }
  function dollarsToCents(v) { return Math.round(Number(v) * 100); }
  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = 'booking-msg show ' + (type || 'error');
  }
  function clearMsg(el) {
    el.className = 'booking-msg';
    el.textContent = '';
  }

  function showLogin() {
    loginWrap.style.display = 'block';
    deniedWrap.style.display = 'none';
    dashboard.style.display = 'none';
  }
  function showDenied(user) {
    loginWrap.style.display = 'none';
    deniedWrap.style.display = 'block';
    dashboard.style.display = 'none';
    deniedEmail.textContent = user.email;
  }
  function showDashboard(user) {
    loginWrap.style.display = 'none';
    deniedWrap.style.display = 'none';
    dashboard.style.display = 'block';
    adminLabel.textContent = user.name + ' (' + user.email + ')';
    if (!dashboardInitialized) {
      dashboardInitialized = true;
      initDashboard();
    }
  }

  function handleUser(user) {
    if (!user) return showLogin();
    if (user.role !== 'admin') return showDenied(user);
    return showDashboard(user);
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMsg(loginMsg);
    var email = document.getElementById('admin-login-email').value.trim();
    var password = document.getElementById('admin-login-password').value;
    window.JoltAuth.login(email, password).then(function (res) {
      if (!res.ok) { showMsg(loginMsg, res.data.error || 'Could not log in.', 'error'); return; }
      handleUser(res.data.user);
    });
  });

  function wireLogout(btnId) {
    var btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', function () {
      window.JoltAuth.logout().then(function () { window.location.href = 'admin.html'; });
    });
  }
  wireLogout('denied-logout');
  wireLogout('admin-logout-btn');

  window.JoltAuth.getMe().then(handleUser);

  // ---- Everything below only runs once we know the user is an admin --------
  function initDashboard() {
    var settingsForm = document.getElementById('settings-form');
    var settingsMsg = document.getElementById('settings-msg');

    function loadSettings() {
      fetch(window.apiUrl('/api/admin/settings'), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var s = data.settings;
          document.getElementById('set-open').value = s.openHour;
          document.getElementById('set-close').value = s.closeHour;
          document.getElementById('set-slot').value = s.slotMinutes;
          document.getElementById('set-max').value = s.maxSlotsPerBooking;
          document.getElementById('set-window').value = s.bookingWindowDays;
        })
        .catch(function () { showMsg(settingsMsg, 'Could not load settings.', 'error'); });
    }

    settingsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMsg(settingsMsg);
      var body = {
        openHour: Number(document.getElementById('set-open').value),
        closeHour: Number(document.getElementById('set-close').value),
        slotMinutes: Number(document.getElementById('set-slot').value),
        maxSlotsPerBooking: Number(document.getElementById('set-max').value),
        bookingWindowDays: Number(document.getElementById('set-window').value)
      };
      fetch(window.apiUrl('/api/admin/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.data.error || 'Could not save settings.');
          showMsg(settingsMsg, 'Settings saved.', 'info');
        })
        .catch(function (err) { showMsg(settingsMsg, err.message, 'error'); });
    });

    // ---- Courts -------------------------------------------------------------
    var courtsTbody = document.getElementById('courts-tbody');
    var courtsMsg = document.getElementById('courts-msg');
    var filterCourtSelect = document.getElementById('filter-court');
    var allCourts = [];

    function renderCourts() {
      if (allCourts.length === 0) {
        courtsTbody.innerHTML = '<tr><td colspan="5">No courts yet — add one below.</td></tr>';
        return;
      }
      courtsTbody.innerHTML = '';
      allCourts.forEach(function (court) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><input type="text" class="c-name" value="' + escapeAttr(court.name) + '" /></td>' +
          '<td><input type="text" class="c-desc" value="' + escapeAttr(court.description || '') + '" /></td>' +
          '<td><input type="number" min="0" step="0.01" class="c-rate" value="' + (court.hourly_rate_cents / 100).toFixed(2) + '" /></td>' +
          '<td><label class="admin-toggle"><input type="checkbox" class="c-active" ' + (court.active ? 'checked' : '') + ' /> Active</label></td>' +
          '<td><button type="button" class="admin-row-save">Save</button></td>';
        tr.querySelector('.admin-row-save').addEventListener('click', function () { saveCourt(court.id, tr); });
        courtsTbody.appendChild(tr);
      });
    }

    function saveCourt(id, row) {
      clearMsg(courtsMsg);
      var body = {
        name: row.querySelector('.c-name').value.trim(),
        description: row.querySelector('.c-desc').value.trim(),
        hourlyRateCents: dollarsToCents(row.querySelector('.c-rate').value),
        active: row.querySelector('.c-active').checked
      };
      fetch(window.apiUrl('/api/admin/courts/' + id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.data.error || 'Could not save court.');
          showMsg(courtsMsg, 'Saved ' + body.name + '.', 'info');
          return loadCourts();
        })
        .catch(function (err) { showMsg(courtsMsg, err.message, 'error'); });
    }

    function loadCourts() {
      return fetch(window.apiUrl('/api/admin/courts'), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          allCourts = data.courts || [];
          renderCourts();
          var current = filterCourtSelect.value;
          filterCourtSelect.innerHTML = '<option value="">All courts</option>';
          allCourts.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name + (c.active ? '' : ' (inactive)');
            filterCourtSelect.appendChild(opt);
          });
          filterCourtSelect.value = current;
        })
        .catch(function () {
          courtsTbody.innerHTML = '<tr><td colspan="5">Could not load courts.</td></tr>';
        });
    }

    document.getElementById('add-court-form').addEventListener('submit', function (e) {
      e.preventDefault();
      clearMsg(courtsMsg);
      var name = document.getElementById('new-court-name').value.trim();
      var description = document.getElementById('new-court-desc').value.trim();
      var rate = document.getElementById('new-court-rate').value;

      fetch(window.apiUrl('/api/admin/courts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name, description: description, hourlyRateCents: dollarsToCents(rate) })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.data.error || 'Could not add court.');
          showMsg(courtsMsg, 'Added ' + name + '.', 'info');
          document.getElementById('add-court-form').reset();
          return loadCourts();
        })
        .catch(function (err) { showMsg(courtsMsg, err.message, 'error'); });
    });

    // ---- Users & roles --------------------------------------------------------
    var usersTbody = document.getElementById('users-tbody');
    var usersMsg = document.getElementById('users-msg');

    function loadUsers() {
      fetch(window.apiUrl('/api/admin/users'), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var users = data.users || [];
          if (users.length === 0) {
            usersTbody.innerHTML = '<tr><td colspan="5">No users yet.</td></tr>';
            return;
          }
          usersTbody.innerHTML = '';
          users.forEach(function (u) {
            var tr = document.createElement('tr');
            var otherRole = u.role === 'admin' ? 'user' : 'admin';
            tr.innerHTML =
              '<td>' + escapeAttr(u.name) + '</td>' +
              '<td>' + escapeAttr(u.email) + '</td>' +
              '<td><span class="status-badge ' + (u.role === 'admin' ? 'paid' : 'pending') + '">' + u.role + '</span></td>' +
              '<td>' + u.created_at + '</td>' +
              '<td><button type="button" class="admin-row-save role-toggle">Make ' + otherRole + '</button></td>';
            tr.querySelector('.role-toggle').addEventListener('click', function () { toggleRole(u.id, otherRole); });
            usersTbody.appendChild(tr);
          });
        })
        .catch(function () { usersTbody.innerHTML = '<tr><td colspan="5">Could not load users.</td></tr>'; });
    }

    function toggleRole(id, newRole) {
      clearMsg(usersMsg);
      fetch(window.apiUrl('/api/admin/users/' + id + '/role'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.data.error || 'Could not update role.');
          showMsg(usersMsg, 'Updated.', 'info');
          loadUsers();
        })
        .catch(function (err) { showMsg(usersMsg, err.message, 'error'); });
    }

    // ---- Bookings / payments ---------------------------------------------------
    var bookingsTbody = document.getElementById('bookings-tbody');

    function formatTime(hhmm) {
      var parts = hhmm.split(':');
      var h = Number(parts[0]);
      var suffix = h >= 12 ? 'pm' : 'am';
      var h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + (parts[1] !== '00' ? ':' + parts[1] : '') + suffix;
    }

    function loadBookings() {
      var params = new URLSearchParams();
      var status = document.getElementById('filter-status').value;
      var courtId = document.getElementById('filter-court').value;
      var from = document.getElementById('filter-from').value;
      var to = document.getElementById('filter-to').value;
      if (status) params.set('status', status);
      if (courtId) params.set('courtId', courtId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      bookingsTbody.innerHTML = '<tr><td colspan="8">Loading bookings…</td></tr>';

      fetch(window.apiUrl('/api/admin/bookings?' + params.toString()), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          renderStats(data.summary);
          var bookings = data.bookings || [];
          if (bookings.length === 0) {
            bookingsTbody.innerHTML = '<tr><td colspan="8">No bookings match these filters.</td></tr>';
            return;
          }
          bookingsTbody.innerHTML = '';
          bookings.forEach(function (b) {
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + b.booking_date + '</td>' +
              '<td>' + formatTime(b.start_time) + ' – ' + formatTime(b.end_time) + '</td>' +
              '<td>' + escapeAttr(b.court_name) + '</td>' +
              '<td>' + escapeAttr(b.customer_name) + '</td>' +
              '<td>' + escapeAttr(b.customer_email) + '</td>' +
              '<td>' + money(b.amount_cents) + '</td>' +
              '<td><span class="status-badge ' + b.status + '">' + b.status + '</span></td>' +
              '<td>' + b.created_at + '</td>';
            bookingsTbody.appendChild(tr);
          });
        })
        .catch(function () {
          bookingsTbody.innerHTML = '<tr><td colspan="8">Could not load bookings.</td></tr>';
        });
    }

    function renderStats(summary) {
      if (!summary) return;
      document.getElementById('stat-revenue').textContent = money(summary.totalPaidCents);
      document.getElementById('stat-paid').textContent = summary.paidCount;
      document.getElementById('stat-pending').textContent = summary.pendingCount;
      document.getElementById('stat-today').textContent = summary.todayCount;
      document.getElementById('stat-upcoming').textContent = summary.upcomingCount;
    }

    document.getElementById('filter-apply').addEventListener('click', loadBookings);

    loadSettings();
    loadCourts().then(loadBookings);
    loadUsers();
  }
})();
