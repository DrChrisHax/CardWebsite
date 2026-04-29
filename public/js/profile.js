async function loadProfile() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { username } = await res.json();
  document.getElementById("profile-username").textContent = username;
}

function openModal(id) {
  document.getElementById(id).removeAttribute("hidden");
}

function closeModal(id) {
  document.getElementById(id).setAttribute("hidden", "");
}

async function deactivateAccount() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/user/deactivate", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

async function deleteAccount() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/user/delete", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }
}

document.getElementById("btn-deactivate").addEventListener("click", () => openModal("modal-deactivate"));
document.getElementById("btn-delete").addEventListener("click", () => openModal("modal-delete"));

document.getElementById("deactivate-cancel").addEventListener("click", () => closeModal("modal-deactivate"));
document.getElementById("delete-cancel").addEventListener("click", () => closeModal("modal-delete"));

document.getElementById("deactivate-confirm").addEventListener("click", deactivateAccount);
document.getElementById("delete-confirm").addEventListener("click", deleteAccount);

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.setAttribute("hidden", "");
  });
});

loadProfile();
