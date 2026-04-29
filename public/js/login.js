const identifierInput = document.getElementById("identifier");
const passwordInput = document.getElementById("password");
const formError = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const modalDeactivated = document.getElementById("modal-deactivated");

// Redirect already-logged-in users away from the login page
(function () {
  const token = localStorage.getItem("token");
  if (!token) return;
  fetch("/api/auth/me", {
    headers: { Authorization: "Bearer " + token },
  }).then(function (res) {
    if (res.ok) {
      const params = new URLSearchParams(window.location.search);
      window.location.replace(params.get("redirect") || "/home");
    }
  });
})();

function redirectAfterLogin() {
  const params = new URLSearchParams(window.location.search);
  window.location.replace(params.get("redirect") || "/home");
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: identifierInput.value.trim(),
        password: passwordInput.value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.error === "account_deactivated") {
        modalDeactivated.removeAttribute("hidden");
      } else {
        formError.textContent = data.error || "Login failed";
      }
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
      return;
    }

    localStorage.setItem("token", data.token);
    redirectAfterLogin();
  } catch {
    formError.textContent = "Network error. Please try again.";
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
});

document.getElementById("deactivated-cancel").addEventListener("click", () => {
  modalDeactivated.setAttribute("hidden", "");
});

document
  .getElementById("deactivated-reactivate")
  .addEventListener("click", async () => {
    const btn = document.getElementById("deactivated-reactivate");
    btn.disabled = true;
    btn.textContent = "Reactivating…";

    try {
      const res = await fetch("/api/user/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifierInput.value.trim(),
          password: passwordInput.value,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        modalDeactivated.setAttribute("hidden", "");
        formError.textContent = data.error || "Reactivation failed";
        btn.disabled = false;
        btn.textContent = "Reactivate";
        return;
      }

      localStorage.setItem("token", data.token);
      redirectAfterLogin();
    } catch {
      modalDeactivated.setAttribute("hidden", "");
      formError.textContent = "Network error. Please try again.";
      btn.disabled = false;
      btn.textContent = "Reactivate";
    }
  });
