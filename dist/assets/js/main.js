(function(){
  "use strict";

  // Highlight the current page in the nav
  var here = (window.location.pathname.split('/').pop() || 'index.html');
  document.querySelectorAll('.nav-links a[data-page]').forEach(function (a) {
    if (a.getAttribute('data-page') === here) a.classList.add('active');
  });

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Reveal the "charge line" signature dividers as they scroll into view
  var lines = document.querySelectorAll('.charge-line');
  if ('IntersectionObserver' in window && lines.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    lines.forEach(function (el) { io.observe(el); });
  } else {
    lines.forEach(function (el) { el.classList.add('in-view'); });
  }

  // Image carousels (e.g. the tile benefits gallery on the shop page)
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('.carousel-slide'));
    var dots = Array.prototype.slice.call(carousel.querySelectorAll('.dot'));
    var prevBtn = carousel.querySelector('.carousel-arrow.prev');
    var nextBtn = carousel.querySelector('.carousel-arrow.next');
    var index = 0;
    var timer = null;

    function show(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { s.classList.toggle('active', n === index); });
      dots.forEach(function (d, n) { d.classList.toggle('active', n === index); });
    }
    function next() { show(index + 1); }
    function prev() { show(index - 1); }
    function startAutoplay() {
      stopAutoplay();
      timer = setInterval(next, 4500);
    }
    function stopAutoplay() { if (timer) clearInterval(timer); }

    if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAutoplay(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAutoplay(); });
    dots.forEach(function (dot, n) {
      dot.addEventListener('click', function () { show(n); startAutoplay(); });
    });
    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);

    if (slides.length > 1) startAutoplay();
  });

  // Contact form -> builds a mailto: link so enquiries land directly in
  // the visitor's own email client (no backend required for this static site)
  var form = document.getElementById('contact-form');
  if (form) {
    // Pre-fill topic/message when arriving from a "Enquire" product link,
    // e.g. contact.html?topic=Paddles&item=Volt%20Pro%20Carbon
    var params = new URLSearchParams(window.location.search);
    var topicField = form.querySelector('[name="topic"]');
    var messageField = form.querySelector('[name="message"]');
    var topicParam = params.get('topic');
    var itemParam = params.get('item');
    if (topicField && topicParam) {
      Array.prototype.forEach.call(topicField.options, function (opt) {
        if (opt.value === topicParam || opt.text === topicParam) topicField.value = opt.value;
      });
    }
    if (messageField && itemParam) {
      messageField.value = 'Hi Jolt team, I\'d like more information on the ' + itemParam + '. ';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var topic = (data.get('topic') || 'General enquiry').toString();
      var message = (data.get('message') || '').toString().trim();
      var to = form.getAttribute('data-to') || 'hello@joltpickleball.com';

      var subject = 'Website enquiry: ' + topic;
      var body =
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n' +
        'Topic: ' + topic + '\n\n' +
        message;

      var mailto = 'mailto:' + encodeURIComponent(to) +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);

      window.location.href = mailto;

      var status = document.getElementById('form-status');
      if (status) {
        status.textContent = 'Opening your email app to send this to ' + to + '…';
        status.classList.add('show');
      }
    });
  }
})();
