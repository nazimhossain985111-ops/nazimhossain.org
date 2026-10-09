/* nazimhossain.org: footer year, menu button and language picker.
   No tracking. Nothing is sent anywhere until a visitor chooses to translate a page. */
(function () {
  "use strict";

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  var menuButton = document.querySelector(".menu-toggle");
  if (menuButton) {
    menuButton.addEventListener("click", function () {
      var open = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!open));
      menuButton.textContent = open ? "Menu" : "Close menu";
    });
  }

  /* Language picker. Each entry: Google Translate code, English name, own name, other name people may type. */
  var LANGUAGES = [
    ["en", "English", "English"], ["bn", "Bangla", "বাংলা", "Bengali"],
    ["am", "Amharic", "አማርኛ"], ["ar", "Arabic", "العربية"],
    ["my", "Burmese", "မြန်မာ", "Myanmar"], ["zh-CN", "Chinese (Simplified)", "简体中文", "Mandarin"],
    ["zh-TW", "Chinese (Traditional)", "繁體中文"], ["da", "Danish", "Dansk"],
    ["nl", "Dutch", "Nederlands"], ["tl", "Filipino", "Filipino", "Tagalog"],
    ["fi", "Finnish", "Suomi"], ["fr", "French", "Français"],
    ["de", "German", "Deutsch"], ["el", "Greek", "Ελληνικά"],
    ["gu", "Gujarati", "ગુજરાતી"], ["ha", "Hausa", "Hausa"],
    ["iw", "Hebrew", "עברית"], ["hi", "Hindi", "हिन्दी"],
    ["id", "Indonesian", "Bahasa Indonesia"], ["it", "Italian", "Italiano"],
    ["ja", "Japanese", "日本語"], ["kn", "Kannada", "ಕನ್ನಡ"],
    ["ko", "Korean", "한국어"], ["ms", "Malay", "Bahasa Melayu"],
    ["ml", "Malayalam", "മലയാളം"], ["mr", "Marathi", "मराठी"],
    ["ne", "Nepali", "नेपाली"], ["no", "Norwegian", "Norsk"],
    ["ps", "Pashto", "پښتو"], ["fa", "Persian", "فارسی", "Farsi"],
    ["pl", "Polish", "Polski"], ["pt", "Portuguese", "Português"],
    ["pa", "Punjabi", "ਪੰਜਾਬੀ"], ["ro", "Romanian", "Română"],
    ["ru", "Russian", "Русский"], ["si", "Sinhala", "සිංහල"],
    ["so", "Somali", "Soomaali"], ["es", "Spanish", "Español"],
    ["sw", "Swahili", "Kiswahili"], ["sv", "Swedish", "Svenska"],
    ["ta", "Tamil", "தமிழ்"], ["te", "Telugu", "తెలుగు"],
    ["th", "Thai", "ไทย"], ["tr", "Turkish", "Türkçe"],
    ["uk", "Ukrainian", "Українська"], ["ur", "Urdu", "اردو"],
    ["vi", "Vietnamese", "Tiếng Việt"], ["zu", "Zulu", "isiZulu"]
  ];

  var form = document.querySelector("[data-lang-form]");
  if (!form) return;
  var input = form.querySelector("#lang-input");
  var list = form.querySelector("#lang-list");
  var opener = form.querySelector("[data-lang-open]");
  var message = form.querySelector("[data-lang-message]");
  var translated = /\.translate\.goog$/.test(location.hostname);
  var matches = [];
  var active = -1;
  form.hidden = false;

  function names(lang) {
    return lang.slice(1).map(function (n) { return n.toLowerCase(); });
  }
  function byCode(code) {
    return LANGUAGES.filter(function (l) { return l[0] === code; })[0] || null;
  }
  function exact(text) {
    var q = text.trim().toLowerCase();
    return LANGUAGES.filter(function (l) { return names(l).indexOf(q) > -1; })[0] || null;
  }
  function find(text) {
    var q = text.trim().toLowerCase();
    if (!q) return LANGUAGES.slice();
    var starts = [], inside = [];
    LANGUAGES.forEach(function (l) {
      var n = names(l);
      if (n.some(function (x) { return x.indexOf(q) === 0; })) starts.push(l);
      else if (q.length > 1 && n.some(function (x) { return x.indexOf(q) > 0; })) inside.push(l);
    });
    return starts.concat(inside);
  }
  function say(text) { message.textContent = text; }

  function setActive(i) {
    var items = list.children;
    if (items[active]) items[active].setAttribute("aria-selected", "false");
    active = i;
    if (items[i]) {
      items[i].setAttribute("aria-selected", "true");
      input.setAttribute("aria-activedescendant", items[i].id);
      items[i].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }
  function render() {
    list.textContent = "";
    matches.forEach(function (lang, i) {
      var li = document.createElement("li");
      li.id = "lang-option-" + lang[0];
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.textContent = lang[1];
      if (lang[2] !== lang[1]) {
        var own = document.createElement("span");
        own.lang = lang[0];
        own.textContent = " (" + lang[2] + ")";
        li.appendChild(own);
      }
      li.addEventListener("mousedown", function (e) { e.preventDefault(); });
      li.addEventListener("click", function () { choose(i); });
      list.appendChild(li);
    });
  }
  function openList(text, highlightFirst) {
    matches = find(text);
    active = -1;
    render();
    if (!matches.length) {
      closeList();
      say("No language matches that name.");
      return;
    }
    say("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setActive(highlightFirst ? 0 : -1);
  }
  function closeList() {
    setActive(-1);
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }
  function choose(i) {
    var lang = matches[i];
    if (!lang) return;
    input.value = lang[1];
    input.dataset.code = lang[0];
    closeList();
    go(lang);
  }
  function go(lang) {
    var canonical = document.querySelector('link[rel="canonical"]');
    var pageUrl = canonical ? canonical.href : location.href;
    if (lang[0] === "en") {
      if (translated) location.href = pageUrl;
      return;
    }
    say("Opening this page in " + lang[1] + ".");
    location.href = "https://translate.google.com/translate?sl=en&tl=" + encodeURIComponent(lang[0]) +
      "&hl=" + encodeURIComponent(lang[0]) + "&u=" + encodeURIComponent(pageUrl);
  }

  if (translated) {
    var current = byCode(new URLSearchParams(location.search).get("_x_tr_tl"));
    if (current) { input.value = current[1]; input.dataset.code = current[0]; }
  }

  input.addEventListener("focus", function () { input.select(); });
  input.addEventListener("click", function () { if (list.hidden) openList("", false); });
  input.addEventListener("blur", closeList);
  input.addEventListener("input", function () {
    delete input.dataset.code;
    if (input.value.trim()) openList(input.value, true);
    else closeList();
  });
  input.addEventListener("keydown", function (e) {
    var isOpen = !list.hidden;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) openList(exact(input.value) ? "" : input.value, true);
      else setActive(Math.min(active + 1, matches.length - 1));
    } else if (e.key === "ArrowUp" && isOpen) {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === "Enter" && isOpen && active > -1) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab" && isOpen && active > -1) {
      choose(active);
    } else if (e.key === "Escape") {
      if (isOpen) { e.preventDefault(); closeList(); }
    }
  });
  opener.addEventListener("mousedown", function (e) { e.preventDefault(); });
  opener.addEventListener("click", function () {
    input.focus();
    if (list.hidden) openList("", false); else closeList();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var lang = byCode(input.dataset.code) || exact(input.value);
    if (lang) go(lang);
    else say("No language matches that name.");
  });
})();
