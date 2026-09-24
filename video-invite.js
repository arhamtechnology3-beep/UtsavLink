(function () {
  "use strict";
  var grid = document.getElementById("grid");
  if (!grid) return;

  fetch("/api/video-templates")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var list = (data && data.templates) || [];
      var price = (data && data.price) || 299;
      if (!list.length) {
        grid.innerHTML = "";
        return;
      }
      grid.innerHTML = list.map(function (t) {
        return '<article class="card">' +
          '<div class="thumb thumb-' + t.id + '"><span>' + escapeHtml(t.collection) + '</span><b>' + escapeHtml(t.title) + '</b></div>' +
          '<div class="card-body">' +
          "<h2>" + escapeHtml(t.title) + "</h2>" +
          '<p class="meta">' + escapeHtml(t.category) + " · " + escapeHtml(t.collection) + "</p>" +
          "<p>" + escapeHtml(t.blurb) + "</p>" +
          '<p class="price">₹' + price + "</p>" +
          '<a class="btn btn-primary" href="/video-edit?theme=' + encodeURIComponent(t.id) + '">Customize →</a>' +
          "</div></article>";
      }).join("");
    })
    .catch(function () {
      grid.innerHTML = "";
    });

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
})();
