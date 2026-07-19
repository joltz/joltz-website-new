(function () {
  "use strict";

  var authGate = document.getElementById('auth-gate');
  var bookingApp = document.getElementById('booking-app');
  if (!authGate || !bookingApp) return; // not on the booking page

  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');
  var authMsg = document.getElementById('auth-msg');
  var accountLabel = document.getElementById('account-label');
  var logoutBtn = document.getElementById('account-logout');

  var courtPicker = document.getElementById('court-picker');
  var dateInput = document.getElementById('booking-date');
  var slotsWrap = document.getElementById('slots-wrap');
  var slotGrid = document.getElementById('slot-grid');
  var summaryBody = document.getElementById('summary-body');
  var form = document.getElementById('booking-form');
  var submitBtn = document.getElementById('booking-submit');
  var msgEl = document.getElementById('booking-msg');
  var confirmPanel = document.getElementById('booking-confirm-panel');

  var state = {
    courts: [],
    selectedCourt: null,
    selectedDate: null,
    daySlots: [],
    selected: [],
    bookingAppInitialized: false
  };

  function money(cents) { return '$' + (cents / 100).toFixed(2); }

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = 'booking-msg show ' + (type || 'error');
  }
  function clearMsg(el) {
    el.className = 'booking-msg';
    el.textContent = '';
  }

  // ---- Auth gate ------------------------------------------------------------
  document.querySelectorAll('.auth-tab').forEach(function (tab) {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      document.querySelectorAll('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var isLogin = tab.getAttribute('data-tab') === 'login';
      loginForm.style.display = isLogin ? 'block' : 'none';
      registerForm.style.display = isLogin ? 'none' : 'block';
      clearMsg(authMsg);
    });
  });

  function onAuthed(user) {
    authGate.style.display = 'none';
    bookingApp.style.display = 'block';
    accountLabel.textContent = user.name + ' (' + user.email + ')';
    if (!state.bookingAppInitialized) {
      state.bookingAppInitialized = true;
      initBookingApp();
    }
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMsg(authMsg);
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    window.JoltAuth.login(email, password).then(function (res) {
      if (!res.ok) { showMsg(authMsg, res.data.error || 'Could not log in.', 'error'); return; }
      onAuthed(res.data.user);
    });
  });

  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMsg(authMsg);
    var name = document.getElementById('register-name').value.trim();
    var email = document.getElementById('register-email').value.trim();
    var password = document.getElementById('register-password').value;
    window.JoltAuth.register(name, email, password).then(function (res) {
      if (!res.ok) { showMsg(authMsg, res.data.error || 'Could not create your account.', 'error'); return; }
      onAuthed(res.data.user);
    });
  });

  logoutBtn.addEventListener('click', function () {
    window.JoltAuth.logout().then(function () { window.location.href = 'book.html'; });
  });

  // ---- Booking flow (only runs once logged in) -------------------------------
  function initBookingApp() {
    function renderCourts() {
      courtPicker.innerHTML = '';
      state.courts.forEach(function (court) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'court-option';
        btn.innerHTML =
          '<h4>' + court.name + '</h4>' +
          '<p>' + (court.description || '') + '</p>' +
          '<span class="price">' + money(court.hourly_rate_cents) + ' / hr</span>';
        btn.addEventListener('click', function () {
          state.selectedCourt = court;
          state.selected = [];
          Array.prototype.forEach.call(courtPicker.children, function (c) { c.classList.remove('selected'); });
          btn.classList.add('selected');
          maybeLoadAvailability();
        });
        courtPicker.appendChild(btn);
      });
    }

    fetch(window.apiUrl('/api/courts'), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.courts = data.courts || [];
        renderCourts();
      })
      .catch(function () {
        courtPicker.innerHTML = '<p class="booking-empty">Couldn\'t load courts. Refresh to try again.</p>';
      });

    fetch(window.apiUrl('/api/config'), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        var today = new Date();
        var max = new Date(Date.now() + (cfg.bookingWindowDays || 21) * 86400000);
        dateInput.min = today.toISOString().slice(0, 10);
        dateInput.max = max.toISOString().slice(0, 10);
        if (!dateInput.value) dateInput.value = dateInput.min;
        maybeLoadAvailability();
      })
      .catch(function () {
        var today = new Date().toISOString().slice(0, 10);
        dateInput.min = today;
        if (!dateInput.value) dateInput.value = today;
      });

    dateInput.addEventListener('change', function () {
      state.selected = [];
      maybeLoadAvailability();
    });

    function maybeLoadAvailability() {
      if (!state.selectedCourt || !dateInput.value) return;
      state.selectedDate = dateInput.value;
      slotsWrap.style.display = 'block';
      slotGrid.innerHTML = '<p class="booking-empty">Loading availability…</p>';

      fetch(window.apiUrl('/api/availability?courtId=' + state.selectedCourt.id + '&date=' + state.selectedDate), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) { slotGrid.innerHTML = ''; showMsg(msgEl, data.error, 'error'); return; }
          state.daySlots = data.slots || [];
          renderSlots();
          renderSummary();
        })
        .catch(function () {
          slotGrid.innerHTML = '<p class="booking-empty">Couldn\'t load availability. Refresh to try again.</p>';
        });
    }

    function renderSlots() {
      slotGrid.innerHTML = '';
      state.daySlots.forEach(function (slot) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'slot-btn';
        btn.textContent = formatTime(slot.start);
        var isSelected = state.selected.some(function (s) { return s.start === slot.start; });
        if (isSelected) btn.classList.add('selected');
        if (!slot.available) btn.disabled = true;
        btn.addEventListener('click', function () { toggleSlot(slot); });
        slotGrid.appendChild(btn);
      });
    }

    function formatTime(hhmm) {
      var parts = hhmm.split(':');
      var h = Number(parts[0]);
      var suffix = h >= 12 ? 'pm' : 'am';
      var h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + (parts[1] !== '00' ? ':' + parts[1] : '') + suffix;
    }

    function toggleSlot(slot) {
      var idx = state.selected.findIndex(function (s) { return s.start === slot.start; });
      if (idx > -1) state.selected.splice(idx, 1);
      else state.selected.push({ start: slot.start, end: slot.end });
      renderSlots();
      renderSummary();
    }

    function sortedSelection() {
      return state.selected.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    }

    function isContiguous(sorted) {
      for (var i = 1; i < sorted.length; i++) {
        if (sorted[i - 1].end !== sorted[i].start) return false;
      }
      return true;
    }

    function renderSummary() {
      clearMsg(msgEl);
      var sorted = sortedSelection();

      if (!state.selectedCourt || sorted.length === 0) {
        summaryBody.innerHTML = '<p class="booking-empty">Choose a court, date and at least one time slot to see your total.</p>';
        form.style.display = 'none';
        return;
      }

      if (!isContiguous(sorted)) {
        showMsg(msgEl, 'Selected hours must be back-to-back. Deselect the gap or start over.', 'error');
        form.style.display = 'none';
        summaryBody.innerHTML = '';
        return;
      }

      var hours = sorted.length;
      var total = state.selectedCourt.hourly_rate_cents * hours;
      var dateLabel = new Date(state.selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
      });

      summaryBody.innerHTML =
        '<div class="summary-row"><span>Court</span><b>' + state.selectedCourt.name + '</b></div>' +
        '<div class="summary-row"><span>Date</span><b>' + dateLabel + '</b></div>' +
        '<div class="summary-row"><span>Time</span><b>' + formatTime(sorted[0].start) + ' – ' + formatTime(sorted[sorted.length - 1].end) + '</b></div>' +
        '<div class="summary-row"><span>Duration</span><b>' + hours + ' hr' + (hours > 1 ? 's' : '') + '</b></div>' +
        '<div class="summary-total"><span>Total</span><span class="price">' + money(total) + '</span></div>';

      form.style.display = 'block';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMsg(msgEl);

      var sorted = sortedSelection();
      if (!state.selectedCourt || sorted.length === 0 || !isContiguous(sorted)) {
        showMsg(msgEl, 'Pick a valid, back-to-back set of hours before continuing.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Redirecting to payment…';
      showMsg(msgEl, 'Hold tight — creating your secure checkout session.', 'info');

      fetch(window.apiUrl('/api/bookings/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courtId: state.selectedCourt.id, date: state.selectedDate, slots: sorted })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.data.error || 'Something went wrong.');
          window.location.href = res.data.url;
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Continue To Payment';
          showMsg(msgEl, err.message, 'error');
          maybeLoadAvailability();
        });
    });
  }

  // ---- Post-payment confirmation / cancellation banner ----------------------
  function handleReturnParams() {
    var params = new URLSearchParams(window.location.search);
    var sessionId = params.get('session_id');
    var canceled = params.get('canceled');

    if (sessionId) {
      bookingApp.style.display = 'none';
      authGate.style.display = 'none';
      confirmPanel.style.display = 'block';
      confirmPanel.innerHTML = '<div class="booking-confirm"><p class="booking-empty">Confirming your payment…</p></div>';

      fetch(window.apiUrl('/api/bookings/confirm?session_id=' + encodeURIComponent(sessionId)), { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) {
            confirmPanel.innerHTML = '<div class="booking-confirm"><h3>We couldn\'t find that booking</h3><p style="color:var(--chalk-dim);">' + data.error + '</p></div>';
            return;
          }
          var b = data.booking;
          var paid = b.status === 'paid';
          confirmPanel.innerHTML =
            '<div class="booking-confirm ' + (paid ? 'paid' : '') + '">' +
            '<h3>' + (paid ? "You're booked! \ud83c\udfbe" : 'Payment pending') + '</h3>' +
            '<p style="color:var(--chalk-dim);">' + (paid
              ? 'A confirmation has been sent to ' + b.email + '. See you on the court.'
              : 'We\'re still waiting on payment confirmation. Refresh in a moment, or check your email.') + '</p>' +
            '<dl>' +
            '<dt>Court</dt><dd>' + b.court + '</dd>' +
            '<dt>Date</dt><dd>' + b.date + '</dd>' +
            '<dt>Time</dt><dd>' + b.start + ' \u2013 ' + b.end + '</dd>' +
            '<dt>Total</dt><dd>' + money(b.amountCents) + '</dd>' +
            '</dl>' +
            '<a href="book.html" class="btn btn-outline" style="margin-top:22px;">Book Another Slot</a>' +
            '</div>';
        })
        .catch(function () {
          confirmPanel.innerHTML = '<div class="booking-confirm"><h3>We couldn\'t confirm that booking</h3><p style="color:var(--chalk-dim);">Please check your email for a receipt, or contact us if you were charged.</p></div>';
        });
      return true;
    } else if (canceled) {
      showMsg(msgEl, 'Checkout was canceled — you were not charged. Pick your slot again whenever you\'re ready.', 'info');
    }
    return false;
  }

  // ---- Init -------------------------------------------------------------------
  var showedConfirm = handleReturnParams();
  window.JoltAuth.getMe().then(function (user) {
    if (showedConfirm) return; // confirmation panel already replaced the view
    if (user) onAuthed(user);
    else { authGate.style.display = 'block'; bookingApp.style.display = 'none'; }
  });
})();
