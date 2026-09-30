db.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = "accueil.html";
});

const formulaire = document.getElementById("formulaire");
const message = document.getElementById("message");

formulaire.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";

  const email = document.getElementById("email").value;
  const motdepasse = document.getElementById("motdepasse").value;

  const { error } = await db.auth.signInWithPassword({
    email: email,
    password: motdepasse,
  });

  if (error) {
    message.textContent = "Email ou mot de passe incorrect.";
    return;
  }

  window.location.href = "accueil.html";
});
