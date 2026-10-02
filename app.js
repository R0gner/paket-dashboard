(function () {
  "use strict";

  var RANG = { pickup_ready: 0, in_transit: 1, delivered: 2 };

  function atPast(days, hour, minute) {
    var t = new Date();
    t.setHours(hour, minute, 0, 0);
    t.setDate(t.getDate() - days);
    if (t.getTime() > Date.now()) t.setDate(t.getDate() - 1);
    return t.toISOString();
  }

  function daysAhead(days, hour, minute) {
    var t = new Date();
    t.setHours(hour, minute, 0, 0);
    t.setDate(t.getDate() + days);
    return t.toISOString();
  }

  var orders = [
    { id: "ord-amazon", shop: "Amazon", number: "304-8821947-771" },
    { id: "ord-atelier", shop: "Atelier Nordlicht", number: "AN-2044" }
  ];

  var places = [
    {
      id: "place-altona",
      name: "Hermes PaketShop Altona",
      street: "Musterstraße 7",
      city: "22765 Hamburg",
      hours: "Mo–Fr 10:00–18:30 · Sa 10:00–13:00"
    }
  ];

  var packages = [
    {
      id: "pkg-hermes",
      direction: "in",
      status: "pickup_ready",
      order_id: null,
      sender: null,
      carrier: "Hermes",
      eta: null,
      price: null,
      place_id: "place-altona",
      pickup_code: "739154",
      deadline: daysAhead(14, 18, 0)
    },
    {
      id: "pkg-friend",
      direction: "in",
      status: "in_transit",
      order_id: null,
      sender: "Jonas",
      carrier: null,
      eta: null,
      price: null,
      place_id: null,
      pickup_code: null,
      deadline: null
    },
    {
      id: "pkg-amazon-open",
      direction: "in",
      status: "in_transit",
      order_id: "ord-amazon",
      sender: "Amazon",
      carrier: null,
      eta: null,
      price: null,
      place_id: null,
      pickup_code: null,
      deadline: null
    },
    {
      id: "pkg-filament",
      direction: "in",
      status: "in_transit",
      order_id: "ord-amazon",
      sender: "Amazon",
      carrier: "DHL",
      eta: daysAhead(0, 14, 0),
      price: null,
      place_id: null,
      pickup_code: null,
      deadline: null
    },
    {
      id: "pkg-archiv",
      direction: "in",
      status: "delivered",
      order_id: "ord-atelier",
      sender: "Atelier Nordlicht",
      carrier: "DHL",
      eta: null,
      price: null,
      place_id: null,
      pickup_code: null,
      deadline: null
    },
    {
      id: "pkg-return",
      direction: "out",
      status: "in_transit",
      order_id: null,
      sender: "Rücksendung",
      carrier: "DHL",
      eta: null,
      price: null,
      place_id: null,
      pickup_code: null,
      deadline: null
    }
  ];

  var items = [
    { package_id: "pkg-amazon-open", title: "Elektronik-Modul", price: null },
    { package_id: "pkg-filament", title: "3D-Filament PLA schwarz", price: null },
    { package_id: "pkg-archiv", title: "Leinenkissen sand", price: null },
    { package_id: "pkg-return", title: "Wollpullover", price: null }
  ];

  var legs = [
    { package_id: "pkg-filament", seq: 1, label: "China-Leg", carrier: "Lian Express", number: null },
    { package_id: "pkg-filament", seq: 2, label: "DHL", carrier: "DHL", number: "DEMO-DHL-44019823" },
    { package_id: "pkg-archiv", seq: 1, label: "DHL", carrier: "DHL", number: "DEMO-DHL-22001108" },
    { package_id: "pkg-return", seq: 1, label: "DHL", carrier: "DHL", number: "DEMO-DHL-88004211" }
  ];

  var events = [
    { package_id: "pkg-hermes", at: atPast(2, 16, 40), raw_text: "Unterwegs zum Paketshop", note: "Lagerfrist 14 Tage" },
    { package_id: "pkg-hermes", at: atPast(0, 7, 5), raw_text: "In Filiale gebracht", note: "abholbereit ab 10:00" },
    { package_id: "pkg-friend", at: atPast(1, 15, 10), raw_text: "In Zustellung", note: null },
    { package_id: "pkg-friend", at: atPast(0, 9, 20), raw_text: "Beim Nachbarn abgegeben", note: "bei Lena" },
    { package_id: "pkg-amazon-open", at: atPast(1, 11, 30), raw_text: "Bestellung bestätigt", note: null },
    { package_id: "pkg-amazon-open", at: atPast(0, 6, 40), raw_text: "Versand angekündigt", note: null },
    { package_id: "pkg-filament", at: atPast(4, 14, 20), raw_text: "Vom Absender übernommen", note: null },
    { package_id: "pkg-filament", at: atPast(1, 11, 5), raw_text: "Im Zielland angekommen", note: null },
    { package_id: "pkg-filament", at: atPast(1, 19, 40), raw_text: "An DHL übergeben", note: null },
    { package_id: "pkg-filament", at: atPast(0, 8, 12), raw_text: "In Zustellung", note: null },
    { package_id: "pkg-archiv", at: atPast(4, 9, 30), raw_text: "Vom Shop übergeben", note: null },
    { package_id: "pkg-archiv", at: atPast(1, 18, 4), raw_text: "Zugestellt", note: null },
    { package_id: "pkg-return", at: atPast(0, 10, 5), raw_text: "An DHL übergeben", note: null }
  ];

  var state = { openId: null, archivOpen: false };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function present(v) {
    return v != null && String(v).trim() !== "";
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function orderOf(pkg) {
    if (!present(pkg.order_id)) return null;
    return byId(orders, pkg.order_id);
  }

  function placeOf(pkg) {
    if (!present(pkg.place_id)) return null;
    return byId(places, pkg.place_id);
  }

  function itemsOf(pkg) {
    return items.filter(function (it) { return it.package_id === pkg.id && present(it.title); });
  }

  function legsOf(pkg) {
    return legs
      .filter(function (leg) { return leg.package_id === pkg.id; })
      .sort(function (a, b) { return a.seq - b.seq; });
  }

  function eventsOf(pkg) {
    return events
      .filter(function (ev) { return ev.package_id === pkg.id && present(ev.raw_text); })
      .sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
  }

  function latestEvent(pkg) {
    var list = eventsOf(pkg);
    return list.length ? list[list.length - 1] : null;
  }

  function cardTitle(pkg) {
    var place = placeOf(pkg);
    if (pkg.status === "pickup_ready" && place && present(place.name)) return place.name;
    var order = orderOf(pkg);
    if (order && present(order.shop)) return order.shop;
    if (present(pkg.sender)) return pkg.sender;
    return "unbekannt";
  }

  function monogram(title) {
    var parts = title.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return title.charAt(0).toUpperCase();
  }

  function formatWhen(iso) {
    if (!present(iso)) return "";
    var d = new Date(iso);
    var now = new Date();
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var diff = Math.round((a - b) / 86400000);
    var hm = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (diff === 0) return "heute " + hm;
    if (diff === 1) return "gestern " + hm;
    if (diff === 2) return "vorgestern " + hm;
    if (diff > 2 && diff < 14) return "vor " + diff + " Tagen, " + hm;
    var date = d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
    return date + ", " + hm;
  }

  function formatDeadline(iso) {
    var d = new Date(iso);
    var date = d.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
    return "Abholen bis " + date;
  }

  function withinDays(iso, days) {
    if (!present(iso)) return false;
    var then = new Date(iso).getTime();
    return Date.now() - then <= days * 86400000 && then <= Date.now() + 60000;
  }

  function incomingActive(pkg) {
    return pkg.direction === "in" && pkg.status !== "delivered";
  }

  function addressLine(place) {
    if (!place) return "";
    var parts = [];
    if (present(place.street)) parts.push(place.street);
    if (present(place.city)) parts.push(place.city);
    return parts.join(", ");
  }

  function tone(pkg) {
    if (pkg.direction === "out" || pkg.status === "delivered") return "tone-quiet";
    if (pkg.status === "pickup_ready") return "tone-pickup";
    return "tone-road";
  }

  function orderBlock(pkg) {
    var order = orderOf(pkg);
    if (!order) return "";
    var bits = [];
    if (present(order.number)) bits.push(order.number);
    var titles = itemsOf(pkg).map(function (it) { return it.title; });
    var html = "";
    if (bits.length) html += '<p class="order-line">' + esc(bits.join(" · ")) + "</p>";
    if (titles.length) html += '<p class="items-line">' + esc(titles.join(" · ")) + "</p>";
    return html;
  }

  function noteLine(ev) {
    if (!ev || !present(ev.note)) return "";
    return '<p class="note">' + esc(ev.note) + "</p>";
  }

  function foot(pkg, ev) {
    var bits = [];
    if (present(pkg.carrier) && pkg.status !== "pickup_ready") {
      bits.push('<span class="carrier">' + esc(pkg.carrier) + "</span>");
    }
    if (present(pkg.eta)) {
      bits.push('<span class="eta">Voraussichtlich ' + esc(formatWhen(pkg.eta)) + "</span>");
    }
    if (ev) bits.push('<span class="when">' + esc(formatWhen(ev.at)) + "</span>");
    if (!bits.length) return "";
    return '<div class="foot">' + bits.join("") + "</div>";
  }

  function cardButton(pkg, extraClass) {
    var ev = latestEvent(pkg);
    var where = ev ? ev.raw_text : "";
    var title = cardTitle(pkg);
    return (
      '<button class="card ' + tone(pkg) + " " + (extraClass || "") + '" type="button" data-open="' + esc(pkg.id) + '">' +
        '<div class="ident">' +
          '<span class="mono" aria-hidden="true">' + esc(monogram(title)) + "</span>" +
          '<div class="who"><h2>' + esc(title) + "</h2>" + orderBlock(pkg) + "</div>" +
        "</div>" +
        (present(where) ? '<p class="where">' + esc(where) + "</p>" : "") +
        noteLine(ev) +
        foot(pkg, ev) +
      "</button>"
    );
  }

  function pickupButton(pkg) {
    var ev = latestEvent(pkg);
    var place = placeOf(pkg);
    var title = cardTitle(pkg);
    var addr = addressLine(place);
    var html =
      '<button class="pickup ' + tone(pkg) + '" type="button" data-open="' + esc(pkg.id) + '">' +
        '<div class="ident">' +
          '<span class="mono" aria-hidden="true">' + esc(monogram(title)) + "</span>" +
          '<div class="who"><h2>' + esc(title) + "</h2>" + orderBlock(pkg) + "</div>" +
        "</div>" +
        "<div>";
    if (ev && present(ev.raw_text)) html += '<p class="where">' + esc(ev.raw_text) + "</p>";
    if (present(addr)) html += '<p class="addr">' + esc(addr) + "</p>";
    if (present(pkg.deadline)) html += '<p class="deadline">' + esc(formatDeadline(pkg.deadline)) + "</p>";
    html += noteLine(ev);
    html += foot(pkg, ev);
    html += "</div></button>";
    return html;
  }

  function renderBoard() {
    var active = packages.filter(incomingActive);
    var pickups = active.filter(function (p) { return p.status === "pickup_ready"; });
    var moving = active.filter(function (p) { return p.status !== "pickup_ready"; });
    moving.sort(function (a, b) {
      var ea = latestEvent(a);
      var eb = latestEvent(b);
      return new Date(eb ? eb.at : 0) - new Date(ea ? ea.at : 0);
    });

    var archiv = packages.filter(function (p) {
      if (p.direction !== "in" || p.status !== "delivered") return false;
      var ev = latestEvent(p);
      return ev && withinDays(ev.at, 14);
    });

    var outgoing = packages.filter(function (p) { return p.direction === "out"; });

    var html = "";

    if (pickups.length) {
      html += '<section class="block"><h2 class="section-label">Abholung</h2>';
      pickups.forEach(function (p) { html += pickupButton(p); });
      html += "</section>";
    }

    if (moving.length) {
      html += '<section class="block grow"><h2 class="section-label">Unterwegs</h2><div class="cards">';
      moving.forEach(function (p) { html += cardButton(p); });
      html += "</div></section>";
    }

    html += '<section class="block"><button class="bar" type="button" id="archiv-toggle" aria-expanded="' + (state.archivOpen ? "true" : "false") + '">';
    html += "<strong>Archiv</strong><span>" + archiv.length + " zugestellt in 14 Tagen <span class=\"chev\">" + (state.archivOpen ? "\u2013" : "+") + "</span></span></button>";
    if (state.archivOpen) {
      html += '<div class="archiv-list">';
      if (!archiv.length) html += '<p class="fine">Nichts Zugestelltes in den letzten 14 Tagen.</p>';
      archiv.forEach(function (p) { html += cardButton(p, "archiv-card"); });
      html += "</div>";
    }
    html += "</section>";

    if (outgoing.length) {
      html += '<section class="block"><p class="quiet-label">Ausgang</p>';
      outgoing.forEach(function (p) {
        var ev = latestEvent(p);
        var title = cardTitle(p);
        html += '<button class="quiet-row tone-quiet" type="button" data-open="' + esc(p.id) + '">';
        html += "<strong>" + esc(title) + "</strong>";
        if (ev) html += '<span class="where">' + esc(ev.raw_text) + "</span>";
        if (present(p.carrier)) html += '<span class="carrier">' + esc(p.carrier) + "</span>";
        if (ev) html += '<span class="when">' + esc(formatWhen(ev.at)) + "</span>";
        html += "</button>";
      });
      html += "</section>";
    }

    document.getElementById("count").textContent = active.length + " aktiv";
    return html;
  }

  function renderLegs(pkg) {
    var list = legsOf(pkg);
    if (!list.length) return "";
    var html = "<div><h3>Etappen</h3><ol class=\"steps\">";
    list.forEach(function (leg, i) {
      var current = pkg.status === "in_transit" && i === list.length - 1;
      var name = present(leg.label) ? leg.label : leg.carrier;
      html += '<li class="step' + (current ? " is-current" : "") + '"><div class="rail"><span class="dot"></span>';
      if (i < list.length - 1) html += '<span class="stem"></span>';
      html += '</div><div class="step-body"><p class="step-name">' + esc(name || "") + "</p>";
      if (present(leg.carrier) && leg.carrier !== name) {
        html += '<p class="step-meta">' + esc(leg.carrier) + "</p>";
      }
      if (current) html += '<p class="step-meta">aktuell</p>';
      if (present(leg.number)) html += '<p class="num">' + esc(leg.number) + "</p>";
      html += "</div></li>";
    });
    html += "</ol></div>";
    return html;
  }

  function renderItems(pkg) {
    var list = itemsOf(pkg);
    if (!list.length) return "";
    var html = "<div><h3>Inhalt</h3><ul class=\"item-list\">";
    list.forEach(function (it) {
      html += "<li>" + esc(it.title) + "</li>";
    });
    html += "</ul></div>";
    return html;
  }

  function renderVerlauf(pkg) {
    var list = eventsOf(pkg);
    if (!list.length) return "";
    var html = "<div><h3>Verlauf</h3><ol class=\"event-list\">";
    list.forEach(function (ev) {
      html += "<li><span class=\"event-time\">" + esc(formatWhen(ev.at)) + "</span><div>";
      html += '<p class="event-text">' + esc(ev.raw_text) + "</p>";
      if (present(ev.note)) html += '<p class="event-note">' + esc(ev.note) + "</p>";
      html += "</div></li>";
    });
    html += "</ol></div>";
    return html;
  }

  function renderDetail(pkg) {
    var ev = latestEvent(pkg);
    var place = placeOf(pkg);
    var title = cardTitle(pkg);
    var addr = addressLine(place);
    var showPlace = pkg.status === "pickup_ready" && place;

    var side = "";
    side += renderItems(pkg);
    if (present(pkg.pickup_code)) {
      side += "<div><h3>Abholcode</h3><p class=\"code\">" + esc(pkg.pickup_code) + "</p></div>";
    }
    if (showPlace) {
      side += "<div><h3>Filiale</h3>";
      if (present(place.name)) side += "<p>" + esc(place.name) + "</p>";
      if (present(addr)) side += '<p class="fine">' + esc(addr) + "</p>";
      if (present(place.hours)) side += '<p class="hours">' + esc(place.hours) + "</p>";
      if (present(pkg.deadline)) side += '<p class="deadline">' + esc(formatDeadline(pkg.deadline)) + "</p>";
      side += "</div>";
    }
    var main = renderLegs(pkg) + renderVerlauf(pkg);
    var grid = side
      ? '<div class="sheet-grid"><div>' + side + "</div><div>" + main + "</div></div>"
      : '<div class="sheet-single">' + main + "</div>";

    return (
      '<section class="sheet">' +
        '<div class="sheet-top">' +
          '<div class="ident">' +
            '<span class="mono" aria-hidden="true">' + esc(monogram(title)) + "</span>" +
            '<div class="who"><h2>' + esc(title) + "</h2>" + orderBlock(pkg) + "</div>" +
          "</div>" +
          '<button class="back" type="button" id="close-detail">Schließen</button>' +
        "</div>" +
        (ev && present(ev.raw_text) ? '<p class="where">' + esc(ev.raw_text) + "</p>" : "") +
        noteLine(ev) +
        foot(pkg, ev) +
        grid +
      "</section>"
    );
  }

  function render() {
    var view = document.getElementById("view");
    if (state.openId) {
      var pkg = byId(packages, state.openId);
      view.innerHTML = pkg ? renderDetail(pkg) : renderBoard();
      if (!pkg) state.openId = null;
    } else {
      view.innerHTML = renderBoard();
    }
  }

  function tick() {
    var now = new Date();
    var clock = document.getElementById("clock");
    var day = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      weekday: "short",
      day: "numeric",
      month: "short"
    }).format(now);
    var time = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit"
    }).format(now);
    clock.dateTime = now.toISOString();
    clock.innerHTML = '<span class="clock-day">' + esc(day) + "</span>" + esc(time);
  }

  document.getElementById("view").addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) {
      state.openId = open.getAttribute("data-open");
      render();
      return;
    }
    if (e.target.closest("#archiv-toggle")) {
      state.archivOpen = !state.archivOpen;
      render();
      return;
    }
    if (e.target.closest("#close-detail")) {
      state.openId = null;
      render();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && state.openId) {
      state.openId = null;
      render();
    }
  });

  tick();
  setInterval(tick, 15000);
  render();
})();
