async function verifier() {
  const { data } = await db.auth.getSession();

  if (!data.session) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("bonjour").textContent =
    "Connecté : " + data.session.user.email;
}

verifier();

document.getElementById("deconnexion").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "index.html";
});
