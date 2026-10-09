/* Forms on the Need Help and Suggestions pages: word count, checks and sending. */
(function () {
  "use strict";

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function countWords(text) {
    var words = text.trim().split(/\s+/);
    return words[0] === "" ? 0 : words.length;
  }

  function setupWordCount(form) {
    var box = form.querySelector("[data-max-words]");
    var count = form.querySelector("[data-count]");
    var limit = form.querySelector("[data-limit]");
    var max = Number(box.getAttribute("data-max-words"));
    var wasOver = false;

    function update() {
      var used = countWords(box.value);
      var over = used > max;
      var text = used + " of " + max + " words used.";
      if (over) text += " Please remove " + (used - max) + (used - max === 1 ? " word." : " words.");
      count.textContent = text;
      count.classList.toggle("over", over);
      if (used >= max && !wasOver) limit.textContent = "You have reached the limit of " + max + " words.";
      if (used < max) limit.textContent = "";
      wasOver = used >= max;
    }
    box.addEventListener("input", update);
    form.addEventListener("reset", function () { setTimeout(update, 0); });
    update();
    return function () { return countWords(box.value) <= max ? null : "Your message is longer than " + max + " words. Please shorten it."; };
  }

  function setupOther(form) {
    var choice = form.querySelector("[data-other-choice]");
    if (!choice) return;
    var field = document.getElementById(choice.getAttribute("data-other-choice"));
    var box = field.closest(".other-field");
    function sync() { box.hidden = !choice.checked; }
    choice.addEventListener("change", sync);
    form.addEventListener("reset", function () { setTimeout(sync, 0); });
    sync();
  }

  function clearErrors(form) {
    form.querySelectorAll(".error-text").forEach(function (el) { el.remove(); });
    form.querySelectorAll("[aria-invalid]").forEach(function (el) {
      el.removeAttribute("aria-invalid");
      var ids = (el.getAttribute("aria-describedby") || "").split(" ").filter(function (id) { return id && !/-error$/.test(id); });
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" ")); else el.removeAttribute("aria-describedby");
    });
    form.querySelector("[data-errors]").hidden = true;
  }

  function markError(target, focusEl, message, list) {
    var id = focusEl.id + "-error";
    var note = document.createElement("p");
    note.className = "error-text";
    note.id = id;
    note.textContent = message;
    if (target.tagName === "FIELDSET") {
      target.querySelector("legend").insertAdjacentElement("afterend", note);
      target.querySelectorAll("input").forEach(function (input) { describe(input, id); });
    } else {
      var label = target.closest(".field").querySelector("label");
      label.insertAdjacentElement("afterend", note);
      describe(target, id);
      target.setAttribute("aria-invalid", "true");
    }
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.href = "#" + focusEl.id;
    link.textContent = message;
    link.addEventListener("click", function (event) { event.preventDefault(); focusEl.focus(); });
    item.appendChild(link);
    list.appendChild(item);
  }

  function describe(el, id) {
    var ids = (el.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
    if (ids.indexOf(id) === -1) ids.unshift(id);
    el.setAttribute("aria-describedby", ids.join(" "));
  }

  function validate(form, checkLength) {
    var problems = [];
    form.querySelectorAll("input[required]:not([type=radio]), textarea[required]").forEach(function (el) {
      if (!el.value.trim()) problems.push([el, el, el.getAttribute("data-error")]);
    });
    var email = form.querySelector("input[type=email]");
    if (email.value.trim() && !EMAIL.test(email.value.trim())) {
      problems = problems.filter(function (p) { return p[0] !== email; });
      problems.push([email, email, "Enter an email address in the correct format, like name@example.com."]);
    }
    form.querySelectorAll("[data-required-group]").forEach(function (group) {
      if (!group.querySelector("input:checked")) problems.push([group, group.querySelector("input"), group.getAttribute("data-error")]);
    });
    var other = form.querySelector("[data-other-choice]");
    if (other && other.checked) {
      var field = document.getElementById(other.getAttribute("data-other-choice"));
      if (!field.value.trim()) problems.push([field, field, field.getAttribute("data-error")]);
    }
    var tooLong = checkLength();
    if (tooLong) {
      var box = form.querySelector("[data-max-words]");
      problems = problems.filter(function (p) { return p[0] !== box; });
      problems.push([box, box, tooLong]);
    }
    return problems.sort(function (a, b) {
      return a[1].compareDocumentPosition(b[1]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  function showStatus(form, message, isError) {
    var status = form.querySelector("[data-status]");
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
    status.setAttribute("role", isError ? "alert" : "status");
    status.focus();
  }

  function setup(form) {
    var checkLength = setupWordCount(form);
    setupOther(form);
    form.noValidate = true;
    var button = form.querySelector("button[type=submit]");
    var buttonText = button.textContent;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearErrors(form);
      var status = form.querySelector("[data-status]");
      status.textContent = "";
      var problems = validate(form, checkLength);
      if (problems.length) {
        var box = form.querySelector("[data-errors]");
        var list = box.querySelector("ul");
        list.textContent = "";
        problems.forEach(function (p) { markError(p[0], p[1], p[2], list); });
        box.hidden = false;
        box.focus();
        return;
      }
      button.disabled = true;
      button.textContent = "Sending...";
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            if (!response.ok || !data.ok) throw new Error(data.error || "send failed");
          });
        })
        .then(function () {
          form.reset();
          showStatus(form, form.getAttribute("data-success"), false);
        })
        .catch(function () {
          showStatus(form, "Sorry, your message could not be sent. Please try again in a few minutes, or email me at contact@nazimhossain.org.", true);
        })
        .then(function () {
          button.disabled = false;
          button.textContent = buttonText;
        });
    });
  }

  document.querySelectorAll("[data-form]").forEach(setup);
})();
